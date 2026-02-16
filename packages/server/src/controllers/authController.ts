import { EVENTS } from '@music-together/shared'
import type { MusicSource } from '@music-together/shared'
import * as authService from '../services/authService.js'
import * as neteaseAuth from '../services/neteaseAuthService.js'
import * as kugouAuth from '../services/kugouAuthService.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

/** Get the socket's room mapping (roomId + persistent userId). */
function getSocketMapping(socketId: string) {
  return roomRepo.getSocketMapping(socketId) ?? null
}

export function registerAuthController(io: TypedServer, socket: TypedSocket) {
  // Guard: prevent duplicate 803 processing for the same QR session per socket
  let qrSuccessHandled = false

  // -------------------------------------------------------------------------
  // QR Code Login (Netease + Kugou)
  // -------------------------------------------------------------------------

  const QR_PLATFORMS = new Set<MusicSource>(['netease', 'kugou'])

  socket.on(EVENTS.AUTH_REQUEST_QR, async (data) => {
    qrSuccessHandled = false
    try {
      const platform = data?.platform
      if (!platform || !QR_PLATFORMS.has(platform)) {
        socket.emit(EVENTS.AUTH_QR_STATUS, { status: 800, message: '暂不支持该平台扫码登录' })
        return
      }

      const result = platform === 'netease'
        ? await neteaseAuth.generateQrCode()
        : await kugouAuth.generateQrCode()

      if (!result) {
        socket.emit(EVENTS.AUTH_QR_STATUS, { status: 800, message: '生成二维码失败，请重试' })
        return
      }

      socket.emit(EVENTS.AUTH_QR_GENERATED, { key: result.key, qrimg: result.qrimg })
    } catch (err) {
      logger.error('AUTH_REQUEST_QR error', err, { socketId: socket.id })
      socket.emit(EVENTS.AUTH_QR_STATUS, { status: 800, message: '请求失败，请重试' })
    }
  })

  socket.on(EVENTS.AUTH_CHECK_QR, async (data) => {
    try {
      if (!data?.key) return

      const platform = data.platform
      if (!platform || !(['netease', 'kugou'] as const).includes(platform as 'netease' | 'kugou')) {
        logger.warn('AUTH_CHECK_QR: invalid or missing platform', { platform })
        return
      }

      const result = platform === 'kugou'
        ? await kugouAuth.checkQrStatus(data.key)
        : await neteaseAuth.checkQrStatus(data.key)

      socket.emit(EVENTS.AUTH_QR_STATUS, { status: result.status, message: result.message })

      // On successful login, validate cookie and add to pool (guard against duplicate 803)
      if (result.status === 803 && result.cookie && !qrSuccessHandled) {
        qrSuccessHandled = true

        const infoResult = platform === 'kugou'
          ? await kugouAuth.getUserInfo(result.cookie)
          : await neteaseAuth.getUserInfo(result.cookie)

        if (infoResult.ok) {
          const userInfo = infoResult.data
          const mapping = getSocketMapping(socket.id)
          if (mapping) {
            authService.addCookie(mapping.roomId, platform, mapping.userId, result.cookie, userInfo.nickname, userInfo.vipType)
            broadcastAuthStatus(io, socket, mapping)
          }
          socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
            success: true,
            message: `已登录为 ${userInfo.nickname}`,
            platform,
            cookie: result.cookie,
          })
          logger.info(`${platform} QR login success: ${userInfo.nickname} (vipType=${userInfo.vipType})`)
        } else {
          socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
            success: false,
            message: '登录成功但无法获取用户信息',
            platform,
            reason: infoResult.reason,
          })
        }
      }
    } catch (err) {
      logger.error('AUTH_CHECK_QR error', err, { socketId: socket.id })
      socket.emit(EVENTS.AUTH_QR_STATUS, { status: 800, message: '检查登录状态失败，请重试' })
    }
  })

  // -------------------------------------------------------------------------
  // Manual Cookie (also used for auto-resend from localStorage)
  // -------------------------------------------------------------------------

  const VALID_PLATFORMS = new Set(['netease', 'tencent', 'kugou'])

  socket.on(EVENTS.AUTH_SET_COOKIE, async (data) => {
    try {
      if (!data?.platform || !VALID_PLATFORMS.has(data.platform) || !data?.cookie || typeof data.cookie !== 'string' || data.cookie.length > 8000) {
        socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
          success: false,
          message: '参数不完整',
        })
        return
      }

      const { platform, cookie } = data
      const mapping = getSocketMapping(socket.id)
      const roomId = mapping?.roomId ?? null

      // Fast path: if this exact cookie is already in the room's pool, skip validation.
      // This avoids redundant Netease API calls on every auto-resend / room rejoin.
      if (mapping && roomId && authService.hasCookie(roomId, platform, cookie)) {
        socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
          success: true,
          message: 'Cookie 已生效',
          platform,
          cookie,
        })
        broadcastAuthStatus(io, socket, mapping)
        return
      }

      if (platform === 'netease') {
        // Validate via Netease API (with 1 retry for ANY failure reason).
        // "no profile" doesn't always mean expired — login_status can transiently
        // return empty for valid cookies, especially right after a server restart.
        let infoResult = await neteaseAuth.getUserInfo(cookie)
        if (!infoResult.ok) {
          logger.info(`Netease getUserInfo failed (${infoResult.reason}), retrying once...`)
          await new Promise((r) => setTimeout(r, 1500))
          infoResult = await neteaseAuth.getUserInfo(cookie)
        }

        if (!infoResult.ok) {
          socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
            success: false,
            message: infoResult.reason === 'expired'
              ? 'Cookie 已过期，请重新登录'
              : '验证登录状态失败，将在下次进入房间时重试',
            platform,
            reason: infoResult.reason,
          })
          return
        }

        const userInfo = infoResult.data
        if (mapping && mapping.roomId) {
          authService.addCookie(mapping.roomId, platform, mapping.userId, cookie, userInfo.nickname, userInfo.vipType)
        }
        socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
          success: true,
          message: `已登录为 ${userInfo.nickname}`,
          platform,
          cookie,
        })
      } else if (platform === 'kugou') {
        // Validate Kugou cookie (token+userid) via VIP endpoint
        let infoResult = await kugouAuth.getUserInfo(cookie)
        if (!infoResult.ok) {
          logger.info(`Kugou getUserInfo failed (${infoResult.reason}), retrying once...`)
          await new Promise((r) => setTimeout(r, 1500))
          infoResult = await kugouAuth.getUserInfo(cookie)
        }

        if (infoResult.ok) {
          const userInfo = infoResult.data
          if (mapping && mapping.roomId) {
            authService.addCookie(mapping.roomId, platform, mapping.userId, cookie, userInfo.nickname, userInfo.vipType)
          }
          socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
            success: true,
            message: `已登录（VIP: ${userInfo.vipType > 0 ? '是' : '否'}）`,
            platform,
            cookie,
          })
        } else {
          // Can't validate — store anyway
          if (mapping && mapping.roomId) {
            authService.addCookie(mapping.roomId, platform, mapping.userId, cookie, '手动登录', 0)
          }
          socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
            success: true,
            message: 'Cookie 已保存（验证失败，播放时生效）',
            platform,
            cookie,
          })
        }
      } else {
        // For QQ we can't easily validate — just store it
        if (mapping && mapping.roomId) {
          authService.addCookie(mapping.roomId, platform, mapping.userId, cookie, '手动登录', 0)
        }
        socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
          success: true,
          message: 'Cookie 已保存（无法验证有效性，播放时生效）',
          platform,
          cookie,
        })
      }

      if (mapping) {
        broadcastAuthStatus(io, socket, mapping)
      }
    } catch (err) {
      logger.error('AUTH_SET_COOKIE error', err, { socketId: socket.id })
      socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
        success: false,
        message: '设置 Cookie 失败，请重试',
        reason: 'error',
      })
    }
  })

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  socket.on(EVENTS.AUTH_LOGOUT, (data) => {
    try {
      if (!data?.platform) return
      const mapping = getSocketMapping(socket.id)
      if (mapping) {
        authService.removeCookie(mapping.roomId, data.platform, mapping.userId)
        broadcastAuthStatus(io, socket, mapping)
      }
    } catch (err) {
      logger.error('AUTH_LOGOUT handler error', err, { socketId: socket.id })
    }
  })

  // -------------------------------------------------------------------------
  // Pull current auth status (covers late-mount of useAuth on client)
  // -------------------------------------------------------------------------

  socket.on(EVENTS.AUTH_GET_STATUS, () => {
    try {
      const mapping = getSocketMapping(socket.id)
      if (mapping) {
        broadcastAuthStatus(io, socket, mapping)
      }
    } catch (err) {
      logger.error('AUTH_GET_STATUS handler error', err, { socketId: socket.id })
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
function broadcastAuthStatus(io: TypedServer, socket: TypedSocket, mapping: { roomId: string; userId: string }) {
  // Send personal status to the requesting user (keyed by persistent userId)
  socket.emit(EVENTS.AUTH_MY_STATUS, authService.getUserAuthStatus(mapping.userId, mapping.roomId))
  // Send aggregated status to the room only
  io.to(mapping.roomId).emit(EVENTS.AUTH_STATUS_UPDATE, authService.getAllPlatformStatus(mapping.roomId))
}
