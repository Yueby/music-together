import { EVENTS } from '@music-together/shared'
import * as authService from '../services/authService.js'
import * as neteaseAuth from '../services/neteaseAuthService.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

/** Get the roomId the socket is currently in (if any). */
function getSocketRoomId(socketId: string): string | null {
  const mapping = roomRepo.getSocketMapping(socketId)
  return mapping?.roomId ?? null
}

export function registerAuthController(io: TypedServer, socket: TypedSocket) {
  // -------------------------------------------------------------------------
  // Netease QR Code Login
  // -------------------------------------------------------------------------

  socket.on(EVENTS.AUTH_REQUEST_QR, async (data) => {
    if (data?.platform !== 'netease') {
      socket.emit(EVENTS.AUTH_QR_STATUS, { status: 800, message: '暂不支持该平台扫码登录' })
      return
    }

    const result = await neteaseAuth.generateQrCode()
    if (!result) {
      socket.emit(EVENTS.AUTH_QR_STATUS, { status: 800, message: '生成二维码失败，请重试' })
      return
    }

    socket.emit(EVENTS.AUTH_QR_GENERATED, { key: result.key, qrimg: result.qrimg })
  })

  socket.on(EVENTS.AUTH_CHECK_QR, async (data) => {
    if (!data?.key) return

    const result = await neteaseAuth.checkQrStatus(data.key)
    socket.emit(EVENTS.AUTH_QR_STATUS, { status: result.status, message: result.message })

    // On successful login, validate cookie and add to pool
    if (result.status === 803 && result.cookie) {
      const userInfo = await neteaseAuth.getUserInfo(result.cookie)
      if (userInfo) {
        const roomId = getSocketRoomId(socket.id)
        if (roomId) {
          authService.addCookie(roomId, 'netease', socket.id, result.cookie, userInfo.nickname, userInfo.vipType)
          broadcastAuthStatus(io, socket, roomId)
        }
        // Always return success + cookie for client-side persistence
        socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
          success: true,
          message: `已登录为 ${userInfo.nickname}`,
          platform: 'netease',
          cookie: result.cookie,
        })
        logger.info(`Netease QR login success: ${userInfo.nickname} (vipType=${userInfo.vipType})`)
      } else {
        socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
          success: false,
          message: '登录成功但无法获取用户信息',
          platform: 'netease',
        })
      }
    }
  })

  // -------------------------------------------------------------------------
  // Manual Cookie (also used for auto-resend from localStorage)
  // -------------------------------------------------------------------------

  socket.on(EVENTS.AUTH_SET_COOKIE, async (data) => {
    if (!data?.platform || !data?.cookie) {
      socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
        success: false,
        message: '参数不完整',
      })
      return
    }

    const { platform, cookie } = data
    const roomId = getSocketRoomId(socket.id)

    // Fast path: if this exact cookie is already in the room's pool, skip validation.
    // This avoids redundant Netease API calls on every auto-resend / room rejoin.
    if (roomId && authService.hasCookie(roomId, platform, cookie)) {
      socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
        success: true,
        message: 'Cookie 已生效',
        platform,
        cookie,
      })
      broadcastAuthStatus(io, socket, roomId)
      return
    }

    if (platform === 'netease') {
      // Validate via Netease API
      const userInfo = await neteaseAuth.getUserInfo(cookie)
      if (!userInfo) {
        socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
          success: false,
          message: 'Cookie 无效或已过期',
          platform,
        })
        return
      }
      if (roomId) {
        authService.addCookie(roomId, platform, socket.id, cookie, userInfo.nickname, userInfo.vipType)
      }
      socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
        success: true,
        message: `已登录为 ${userInfo.nickname}`,
        platform,
        cookie,
      })
    } else {
      // For QQ/Kugou we can't easily validate — just store it
      if (roomId) {
        authService.addCookie(roomId, platform, socket.id, cookie, '手动登录', 0)
      }
      socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
        success: true,
        message: 'Cookie 已保存（无法验证有效性，播放时生效）',
        platform,
        cookie,
      })
    }

    if (roomId) {
      broadcastAuthStatus(io, socket, roomId)
    }
  })

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  socket.on(EVENTS.AUTH_LOGOUT, (data) => {
    if (!data?.platform) return
    const roomId = getSocketRoomId(socket.id)
    if (roomId) {
      authService.removeCookie(roomId, data.platform, socket.id)
      broadcastAuthStatus(io, socket, roomId)
    }
  })

  // -------------------------------------------------------------------------
  // Pull current auth status (covers late-mount of useAuth on client)
  // -------------------------------------------------------------------------

  socket.on(EVENTS.AUTH_GET_STATUS, () => {
    const roomId = getSocketRoomId(socket.id)
    if (roomId) {
      broadcastAuthStatus(io, socket, roomId)
    }
  })

  // NOTE: No disconnect handler — cookies stay in the room pool
  // until the room itself is destroyed (see roomService.scheduleDeletion).
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Broadcast auth status within a room (room-scoped, not global).
 * Sends personal status to the requesting user + aggregated status to the room.
 */
function broadcastAuthStatus(io: TypedServer, socket: TypedSocket, roomId: string) {
  // Send personal status to the requesting user
  socket.emit(EVENTS.AUTH_MY_STATUS, authService.getUserAuthStatus(socket.id, roomId))
  // Send aggregated status to the room only
  io.to(roomId).emit(EVENTS.AUTH_STATUS_UPDATE, authService.getAllPlatformStatus(roomId))
}
