import { EVENTS, QR_STATUS } from '@music-together/shared'
import type { MusicSource } from '@music-together/shared'
import * as authService from '../services/authService.js'
import { AUTH_PROVIDERS } from '../services/authProvider.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

/** 获取 socket 对应的房间映射（roomId + persistent userId） */
function getSocketMapping(socketId: string) {
  return roomRepo.getSocketMapping(socketId) ?? null
}

/** 支持 QR 扫码登录的平台集合 */
const QR_PLATFORMS = new Set<MusicSource>(['netease', 'kugou', 'tencent'])

/** 支持 Cookie 登录的平台集合 */
const VALID_PLATFORMS = new Set<MusicSource>(['netease', 'tencent', 'kugou'])

export function registerAuthController(io: TypedServer, socket: TypedSocket) {
  // 防止同一 QR 会话重复处理 803 成功状态
  let qrSuccessHandled = false

  // -------------------------------------------------------------------------
  // QR 扫码登录（所有平台统一处理）
  // -------------------------------------------------------------------------

  socket.on(EVENTS.AUTH_REQUEST_QR, async (data) => {
    qrSuccessHandled = false
    try {
      const platform = data?.platform
      if (!platform || !QR_PLATFORMS.has(platform)) {
        socket.emit(EVENTS.AUTH_QR_STATUS, { status: QR_STATUS.EXPIRED, message: '暂不支持该平台扫码登录' })
        return
      }

      const provider = AUTH_PROVIDERS[platform]
      const result = await provider.generateQrCode()

      if (!result) {
        socket.emit(EVENTS.AUTH_QR_STATUS, { status: QR_STATUS.EXPIRED, message: '生成二维码失败，请重试' })
        return
      }

      socket.emit(EVENTS.AUTH_QR_GENERATED, { key: result.key, qrimg: result.qrimg })
    } catch (err) {
      logger.error('AUTH_REQUEST_QR error', err, { socketId: socket.id })
      socket.emit(EVENTS.AUTH_QR_STATUS, { status: QR_STATUS.EXPIRED, message: '请求失败，请重试' })
    }
  })

  socket.on(EVENTS.AUTH_CHECK_QR, async (data) => {
    try {
      if (!data?.key) {
        socket.emit(EVENTS.AUTH_QR_STATUS, { status: QR_STATUS.EXPIRED, message: '缺少二维码 key' })
        return
      }

      const platform = data.platform
      if (!platform || !QR_PLATFORMS.has(platform)) {
        logger.warn('AUTH_CHECK_QR: invalid or missing platform', { platform })
        return
      }

      const provider = AUTH_PROVIDERS[platform]
      const result = await provider.checkQrStatus(data.key)

      socket.emit(EVENTS.AUTH_QR_STATUS, { status: result.status, message: result.message })

      // 登录成功：验证 cookie 并加入池（防止重复 803）
      if (result.status === QR_STATUS.SUCCESS && result.cookie && !qrSuccessHandled) {
        qrSuccessHandled = true

        const infoResult = await provider.getUserInfo(result.cookie)

        if (infoResult.ok) {
          const userInfo = infoResult.data
          const mapping = getSocketMapping(socket.id)
          if (mapping) {
            authService.addCookie(
              mapping.roomId,
              platform,
              mapping.userId,
              result.cookie,
              userInfo.nickname,
              userInfo.vipType,
            )
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
      socket.emit(EVENTS.AUTH_QR_STATUS, { status: QR_STATUS.EXPIRED, message: '检查登录状态失败，请重试' })
    }
  })

  // -------------------------------------------------------------------------
  // 手动 Cookie 登录（同时用于 localStorage 自动恢复）
  // 策略模式：所有平台统一流程 — getUserInfo → 重试 → 成功/失败处理
  // -------------------------------------------------------------------------

  socket.on(EVENTS.AUTH_SET_COOKIE, async (data) => {
    try {
      if (
        !data?.platform ||
        !VALID_PLATFORMS.has(data.platform) ||
        !data?.cookie ||
        typeof data.cookie !== 'string' ||
        data.cookie.length > 8000
      ) {
        socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
          success: false,
          message: '参数不完整',
        })
        return
      }

      const { platform, cookie } = data
      const mapping = getSocketMapping(socket.id)
      const roomId = mapping?.roomId ?? null

      // Fast path: cookie 已在房间池中，跳过验证
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

      // 通用验证流程：getUserInfo + 1 次重试
      const provider = AUTH_PROVIDERS[platform]
      let infoResult = await provider.getUserInfo(cookie)
      if (!infoResult.ok) {
        logger.info(`${platform} getUserInfo failed (${infoResult.reason}), retrying once...`)
        await new Promise((r) => setTimeout(r, 1500))
        infoResult = await provider.getUserInfo(cookie)
      }

      if (infoResult.ok) {
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
      } else if (platform === 'netease' && infoResult.reason === 'expired') {
        // 仅网易云：明确过期时拒绝保存
        socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, {
          success: false,
          message: 'Cookie 已过期，请重新登录',
          platform,
          reason: infoResult.reason,
        })
        if (mapping) broadcastAuthStatus(io, socket, mapping)
        return
      } else {
        // 酷狗/QQ 音乐：验证失败也保存（可能是 API 变动，播放时可能仍有效）
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
  // 登出
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
  // 拉取当前认证状态（覆盖延迟挂载场景）
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
 * 广播认证状态（房间级作用域，非全局）
 * 向请求用户发送个人状态 + 向房间广播聚合状态
 */
function broadcastAuthStatus(io: TypedServer, socket: TypedSocket, mapping: { roomId: string; userId: string }) {
  socket.emit(EVENTS.AUTH_MY_STATUS, authService.getUserAuthStatus(mapping.userId, mapping.roomId))
  io.to(mapping.roomId).emit(EVENTS.AUTH_STATUS_UPDATE, authService.getAllPlatformStatus(mapping.roomId))
}
