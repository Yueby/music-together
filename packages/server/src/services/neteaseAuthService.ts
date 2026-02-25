import ncmApi from '@neteasecloudmusicapienhanced/api'
import type { Playlist } from '@music-together/shared'
import type { GetUserInfoResult } from './authProvider.js'
import { logger } from '../utils/logger.js'

/**
 * 网易云音乐认证服务
 * 封装 @neteasecloudmusicapienhanced/api 实现 QR 登录和 Cookie 验证
 * 实现 AuthProvider 接口
 */

// ---------------------------------------------------------------------------
// QR Code 登录
// ---------------------------------------------------------------------------

/**
 * 生成网易云音乐扫码登录二维码
 */
export async function generateQrCode(): Promise<{ key: string; qrimg: string } | null> {
  try {
    const keyRes = await ncmApi.login_qr_key({ timestamp: Date.now() })
    const key = keyRes?.body?.data?.unikey
    if (!key) {
      logger.error('Netease QR: failed to get unikey', keyRes?.body)
      return null
    }

    const qrRes = await ncmApi.login_qr_create({ key, qrimg: true, timestamp: Date.now() })
    const qrimg = qrRes?.body?.data?.qrimg
    if (!qrimg) {
      logger.error('Netease QR: failed to generate QR image', qrRes?.body)
      return null
    }

    logger.info('Netease QR code generated')
    return { key, qrimg }
  } catch (err) {
    logger.error('Netease QR generation failed', err)
    return null
  }
}

/**
 * 检查网易云扫码状态
 * 状态码：800=过期, 801=等待扫码, 802=已扫码待确认, 803=登录成功
 */
export async function checkQrStatus(key: string): Promise<{
  status: number
  message: string
  cookie?: string
}> {
  try {
    const res = await ncmApi.login_qr_check({ key, timestamp: Date.now() })
    const code = res?.body?.code ?? 800
    const cookie = res?.body?.cookie

    const messages: Record<number, string> = {
      800: '二维码已过期，请重新获取',
      801: '等待扫码',
      802: '已扫码，等待确认',
      803: '登录成功',
    }

    return {
      status: code,
      message: messages[code] ?? `未知状态 (${code})`,
      cookie: code === 803 ? cookie : undefined,
    }
  } catch (err) {
    logger.error('Netease QR check failed', err)
    return { status: 800, message: '检查状态失败' }
  }
}

// ---------------------------------------------------------------------------
// Cookie 验证 & 用户信息
// ---------------------------------------------------------------------------

/**
 * 验证 Cookie 并获取用户信息
 * 区分「Cookie 已过期」和「临时故障」，以便调用方决定是否移除 Cookie
 */
export async function getUserInfo(cookie: string): Promise<GetUserInfoResult> {
  try {
    const res = await ncmApi.login_status({ cookie, timestamp: Date.now() })
    const profile = res?.body?.data?.profile

    if (!profile) {
      logger.warn('Netease cookie validation: no profile in response', { responseData: res?.body?.data })
      return { ok: false, reason: 'expired' }
    }

    // vipType: 0=无, 1=VIP, 10=黑胶VIP, 11=黑胶VIP (alias)
    const vipType = profile.vipType ?? 0

    return {
      ok: true,
      data: {
        nickname: profile.nickname || 'Unknown',
        vipType,
        userId: profile.userId ?? 0,
      },
    }
  } catch (err) {
    logger.error('Netease getUserInfo failed (transient error)', err)
    return { ok: false, reason: 'error' }
  }
}

// ---------------------------------------------------------------------------
// 用户歌单
// ---------------------------------------------------------------------------

/**
 * 获取用户网易云歌单列表
 */
export async function getUserPlaylists(cookie: string): Promise<Playlist[]> {
  try {
    const result = await getUserInfo(cookie)
    if (!result.ok) {
      logger.warn(`Cannot fetch playlists: cookie ${result.reason}`)
      return []
    }

    const userInfo = result.data

    const res = await ncmApi.user_playlist({
      uid: userInfo.userId,
      limit: 50,
      offset: 0,
      cookie,
      timestamp: Date.now(),
    })

    const playlists = res?.body?.playlist
    if (!Array.isArray(playlists)) {
      logger.warn('Netease user_playlist: unexpected response', { code: res?.body?.code })
      return []
    }

    const mapped: Playlist[] = playlists.map((p) => ({
      id: String(p.id),
      name: String(p.name || ''),
      cover: String(p.coverImgUrl || ''),
      trackCount: Number(p.trackCount ?? 0),
      source: 'netease' as const,
      creator: String(p.creator?.nickname || ''),
      description: String(p.description || ''),
    }))

    logger.info(`Fetched ${mapped.length} playlists for netease user ${userInfo.nickname}`)
    return mapped
  } catch (err) {
    logger.error('Netease getUserPlaylists failed', err)
    return []
  }
}
