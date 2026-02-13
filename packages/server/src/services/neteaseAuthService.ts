import _ncmApi from '@neteasecloudmusicapienhanced/api'
import { logger } from '../utils/logger.js'

/**
 * Netease Cloud Music authentication service.
 * Wraps @neteasecloudmusicapienhanced/api for QR code login and cookie validation.
 */

// The library's type definitions are incomplete (missing `timestamp` param,
// nested response types like `unikey`, `qrimg`, `profile`, etc.), but the
// runtime API works correctly. Use `as any` to bypass the incomplete types.
const ncmApi = _ncmApi as any

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

/**
 * Validate a cookie and get user info.
 * @returns User info or null if cookie is invalid
 */
export async function getUserInfo(cookie: string): Promise<{
  nickname: string
  vipType: number
  userId: number
} | null> {
  try {
    const res = await ncmApi.login_status({ cookie, timestamp: Date.now() })
    const profile = res?.body?.data?.profile

    if (!profile) {
      logger.warn('Netease cookie validation failed: no profile in response')
      return null
    }

    // vipType: 0=无, 1=VIP, 10=黑胶VIP, 11=黑胶VIP (alias)
    const vipType = profile.vipType ?? 0

    return {
      nickname: profile.nickname || 'Unknown',
      vipType,
      userId: profile.userId,
    }
  } catch (err) {
    logger.error('Netease getUserInfo failed', err)
    return null
  }
}
