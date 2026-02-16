import _ncmApi from '@neteasecloudmusicapienhanced/api'
import type { Playlist } from '@music-together/shared'
import { logger } from '../utils/logger.js'

/**
 * Netease Cloud Music authentication service.
 * Wraps @neteasecloudmusicapienhanced/api for QR code login and cookie validation.
 */

// The library's type definitions are incomplete (missing `timestamp` param,
// nested response types like `unikey`, `qrimg`, `profile`, etc.), but the
// runtime API works correctly. Use `as any` to bypass the incomplete types.
export const ncmApi = _ncmApi as any

// ---------------------------------------------------------------------------
// QR Code Login
// ---------------------------------------------------------------------------

/**
 * Generate a QR code for Netease Cloud Music login.
 * @returns { key: string, qrimg: string } where qrimg is base64 encoded image
 */
export async function generateQrCode(): Promise<{ key: string; qrimg: string } | null> {
  try {
    // Step 1: Get QR key
    const keyRes = await ncmApi.login_qr_key({ timestamp: Date.now() })
    const key = keyRes?.body?.data?.unikey
    if (!key) {
      logger.error('Netease QR: failed to get unikey', keyRes?.body)
      return null
    }

    // Step 2: Generate QR code image
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
 * Check QR code scan status.
 * @returns status code:
 *   - 800: QR expired
 *   - 801: Waiting for scan
 *   - 802: Scanned, waiting for confirm
 *   - 803: Login successful (cookie included)
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
// Cookie validation & user info
// ---------------------------------------------------------------------------

export interface UserInfoData {
  nickname: string
  vipType: number
  userId: number
}

export type GetUserInfoResult =
  | { ok: true; data: UserInfoData }
  | { ok: false; reason: 'expired' | 'error' }

/**
 * Validate a cookie and get user info.
 * Distinguishes between "cookie expired" (API responded but no profile)
 * and "transient error" (network failure, timeout, etc.) so the caller
 * can decide whether to remove the cookie from localStorage.
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
        userId: profile.userId,
      },
    }
  } catch (err) {
    logger.error('Netease getUserInfo failed (transient error)', err)
    return { ok: false, reason: 'error' }
  }
}

// ---------------------------------------------------------------------------
// User playlists
// ---------------------------------------------------------------------------

/**
 * Get a user's playlists from Netease Cloud Music.
 * Requires a valid cookie. Uses the userId from getUserInfo.
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
      logger.warn('Netease user_playlist: unexpected response', res?.body?.code)
      return []
    }

    const mapped: Playlist[] = playlists.map((p: Record<string, any>) => ({
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
