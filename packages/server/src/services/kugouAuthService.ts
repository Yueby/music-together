import crypto from 'node:crypto'
import QRCode from 'qrcode'
import type { Playlist } from '@music-together/shared'
import { logger } from '../utils/logger.js'

/**
 * Kugou Music authentication service.
 * Self-contained implementation extracted from MakcRe/KuGouMusicApi.
 * Handles QR code login, status polling, user info, VIP, and playlists.
 */

// ---------------------------------------------------------------------------
// Constants (from KuGouMusicApi config)
// ---------------------------------------------------------------------------

const APPID = 1005
const SRCAPPID = 2919
const CLIENTVER = 20489

const WEB_SIGNATURE_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'
const ANDROID_SIGNATURE_SALT = 'OIlwieks28dk2k092lksi2UIkp'

const RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIAG7QOELSYoIJvTFJhMpe1s/g
bjDJX51HBNnEl5HXqTW6lQ7LC8jr9fWZTwusknp+sVGzwd40MwP6U5yDE27M/X1+
UR4tvOGOqp94TJtQ1EPnWGWXngpeIW5GxoQGao1rmYWAu6oi1z9XkChrsUdC6DJE
5E221wf/4WLFxwAtRQIDAQAB
-----END PUBLIC KEY-----`

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

function md5(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex')
}

function signatureWebParams(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .map((key) => `${key}=${params[key]}`)
    .sort()
    .join('')
  return md5(`${WEB_SIGNATURE_SALT}${sorted}${WEB_SIGNATURE_SALT}`)
}

function signatureAndroidParams(params: Record<string, unknown>, data?: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => {
      const val = params[key]
      return `${key}=${typeof val === 'object' ? JSON.stringify(val) : val}`
    })
    .join('')
  return md5(`${ANDROID_SIGNATURE_SALT}${sorted}${data || ''}${ANDROID_SIGNATURE_SALT}`)
}

/**
 * RSA encrypt with NO_PADDING (required by Kugou user_detail API).
 * Input is padded to 128 bytes before encryption.
 */
function rsaEncrypt(data: string | Record<string, unknown>): string {
  const str = typeof data === 'object' ? JSON.stringify(data) : data
  const buffer = Buffer.from(str)
  const padded = Buffer.concat([buffer, Buffer.alloc(128 - buffer.length)])
  return crypto.publicEncrypt({ key: RSA_PUBLIC_KEY, padding: crypto.constants.RSA_NO_PADDING }, padded).toString('hex')
}

function randomString(len = 16): string {
  const chars = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let result = ''
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function getGuid(): string {
  const s = () => ((65536 * (1 + Math.random())) | 0).toString(16).substring(1)
  return `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`
}

function calculateMid(str: string): string {
  let bigInt = BigInt(0)
  const base = BigInt(16)
  const digest = md5(str)
  const len = digest.length
  for (let i = 0; i < len; i++) {
    const charValue = BigInt(parseInt(digest.charAt(i), 16))
    const power = base ** BigInt(len - 1 - i)
    bigInt += charValue * power
  }
  return bigInt.toString()
}

const GUID = md5(getGuid())
const MID = calculateMid(GUID)

// ---------------------------------------------------------------------------
// HTTP request helper
// ---------------------------------------------------------------------------

interface KugouRequestConfig {
  baseURL: string
  url: string
  method?: 'GET' | 'POST'
  params: Record<string, unknown>
  data?: Record<string, unknown>
  encryptType: 'web' | 'android'
  cookie?: Record<string, string>
  headers?: Record<string, string>
}

/** Kugou API response (loosely typed — external API). */
interface KugouApiResponse {
  status?: number
  error_code?: number
  data?: Record<string, unknown>
  [key: string]: unknown
}

async function kugouRequest(config: KugouRequestConfig): Promise<KugouApiResponse> {
  const clienttime = Math.floor(Date.now() / 1000)
  const dfid = config.cookie?.dfid || '-'
  const method = config.method || 'GET'

  const defaultParams: Record<string, unknown> = {
    dfid,
    mid: MID,
    uuid: '-',
    appid: APPID,
    clientver: CLIENTVER,
    clienttime,
  }

  if (config.cookie?.token) defaultParams['token'] = config.cookie.token
  if (config.cookie?.userid && config.cookie.userid !== '0') {
    defaultParams['userid'] = config.cookie.userid
  }

  const merged = { ...defaultParams, ...config.params }

  // Stringify POST body (needed for Android signature)
  const bodyStr = config.data ? JSON.stringify(config.data) : ''

  // Compute signature
  if (config.encryptType === 'web') {
    merged['signature'] = signatureWebParams(merged)
  } else {
    merged['signature'] = signatureAndroidParams(merged, bodyStr)
  }

  const qs = Object.entries(merged)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')

  const fullUrl = `${config.baseURL}${config.url}?${qs}`

  const headers: Record<string, string> = {
    'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
    dfid,
    clienttime: String(clienttime),
    mid: MID,
    'kg-rc': '1',
    'kg-thash': '5d816a0',
    'kg-rec': '1',
    'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
    ...config.headers,
  }

  const fetchOpts: RequestInit = { method, headers }
  if (method === 'POST' && bodyStr) {
    headers['Content-Type'] = 'application/json'
    fetchOpts.body = bodyStr
  }

  const res = await fetch(fullUrl, fetchOpts)

  if (!res.ok) {
    throw new Error(`Kugou API HTTP ${res.status} ${res.statusText}: ${config.url}`)
  }

  let body: KugouApiResponse
  try {
    body = (await res.json()) as KugouApiResponse
  } catch {
    throw new Error(`Kugou API JSON parse failed: ${config.url} (HTTP ${res.status})`)
  }

  return body
}

// ---------------------------------------------------------------------------
// QR Code Login
// ---------------------------------------------------------------------------

export async function generateQrCode(): Promise<{ key: string; qrimg: string } | null> {
  try {
    const body = await kugouRequest({
      baseURL: 'https://login-user.kugou.com',
      url: '/v2/qrcode',
      params: {
        appid: APPID,
        type: 1,
        plat: 4,
        qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${APPID}&`,
        srcappid: SRCAPPID,
      },
      encryptType: 'web',
    })

    const qrData = body?.data as Record<string, unknown> | undefined
    const key = qrData?.qrcode as string | undefined
    if (!key) {
      logger.error('Kugou QR: failed to get qrcode key', body)
      return null
    }

    const qrUrl = `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${key}`
    const qrimg = await QRCode.toDataURL(qrUrl, { width: 280, margin: 2 })

    logger.info('Kugou QR code generated')
    return { key, qrimg }
  } catch (err) {
    logger.error('Kugou QR generation failed', err)
    return null
  }
}

const STATUS_MAP: Record<number, number> = {
  0: 800,
  1: 801,
  2: 802,
  4: 803,
}

const STATUS_MESSAGES: Record<number, string> = {
  800: '二维码已过期，请重新获取',
  801: '等待扫码',
  802: '已扫码，等待确认',
  803: '登录成功',
}

export async function checkQrStatus(key: string): Promise<{
  status: number
  message: string
  cookie?: string
}> {
  try {
    const body = await kugouRequest({
      baseURL: 'https://login-user.kugou.com',
      url: '/v2/get_userinfo_qrcode',
      params: {
        plat: 4,
        appid: APPID,
        srcappid: SRCAPPID,
        qrcode: key,
      },
      encryptType: 'web',
    })

    const d = body?.data as Record<string, unknown> | undefined
    const rawStatus = Number(d?.status ?? 0)
    const status = STATUS_MAP[rawStatus] ?? 800
    const message = STATUS_MESSAGES[status] ?? `未知状态 (${rawStatus})`

    if (status === 803 && d?.token && d?.userid) {
      const token = String(d.token)
      const userid = String(d.userid)
      const cookie = `token=${token};userid=${userid}`
      return { status, message, cookie }
    }

    return { status, message }
  } catch (err) {
    logger.error('Kugou QR check failed', err)
    return { status: 800, message: '检查状态失败' }
  }
}

// ---------------------------------------------------------------------------
// User Detail (nickname via RSA-encrypted request)
// ---------------------------------------------------------------------------

/**
 * Fetch user nickname from Kugou's user center API.
 * Requires RSA-encrypted auth payload.
 */
async function fetchUserDetail(cookie: Record<string, string>): Promise<string | null> {
  try {
    const token = cookie['token']
    const userid = Number(cookie['userid'] || '0')
    if (!token || !userid) return null

    const clienttime = Math.floor(Date.now() / 1000)
    const pk = rsaEncrypt({ token, clienttime }).toUpperCase()

    const body = await kugouRequest({
      baseURL: 'https://gateway.kugou.com',
      url: '/v3/get_my_info',
      method: 'POST',
      params: { plat: 1 },
      data: {
        visit_time: clienttime,
        usertype: 1,
        p: pk,
        userid,
      },
      encryptType: 'android',
      cookie,
      headers: { 'x-router': 'usercenter.kugou.com' },
    })

    const d = body?.data as Record<string, unknown> | undefined
    const nickname = String(d?.nick_name || d?.nickname || d?.userName || '')
    if (nickname) {
      logger.info(`Kugou user detail: nickname=${nickname}`)
    } else {
      logger.warn('Kugou user detail: no nickname found in response', { keys: Object.keys(d || {}) })
    }
    return nickname || null
  } catch (err) {
    logger.warn('Kugou fetchUserDetail failed (non-critical)', err as Record<string, unknown>)
    return null
  }
}

// ---------------------------------------------------------------------------
// User Info & VIP
// ---------------------------------------------------------------------------

export interface KugouUserInfoData {
  nickname: string
  vipType: number
  userId: number
}

export type GetUserInfoResult = { ok: true; data: KugouUserInfoData } | { ok: false; reason: 'expired' | 'error' }

/**
 * Validate a Kugou cookie (token+userid) and get VIP info + nickname.
 */
export async function getUserInfo(cookie: string): Promise<GetUserInfoResult> {
  try {
    const cookieObj = parseCookieString(cookie)
    const token = cookieObj['token']
    const userid = cookieObj['userid']

    if (!token || !userid) {
      logger.warn('Kugou getUserInfo: missing token or userid in cookie')
      return { ok: false, reason: 'expired' }
    }

    // Fetch VIP info
    const body = await kugouRequest({
      baseURL: 'https://kugouvip.kugou.com',
      url: '/v1/get_union_vip',
      params: { busi_type: 'concept' },
      encryptType: 'android',
      cookie: { token, userid },
    })

    if (!body?.data) {
      logger.warn('Kugou getUserInfo: no data in VIP response', body)
      return { ok: false, reason: 'expired' }
    }

    const vipData = body.data as Record<string, unknown>
    const isVip = vipData.is_vip === 1 || Number(vipData.vip_type) > 0
    const vipType = isVip ? Number(vipData.vip_type) || 1 : 0

    // Fetch nickname (non-blocking — fallback to userid if failed)
    const nickname = await fetchUserDetail({ token, userid })

    return {
      ok: true,
      data: {
        nickname: nickname || `酷狗用户${userid}`,
        vipType,
        userId: Number(userid),
      },
    }
  } catch (err) {
    logger.error('Kugou getUserInfo failed (transient error)', err)
    return { ok: false, reason: 'error' }
  }
}

// ---------------------------------------------------------------------------
// User Playlists
// ---------------------------------------------------------------------------

/**
 * Fetch user's playlist list from Kugou.
 */
export async function getUserPlaylists(cookie: string): Promise<Playlist[]> {
  try {
    const cookieObj = parseCookieString(cookie)
    const token = cookieObj['token']
    const userid = cookieObj['userid']

    if (!token || !userid) {
      logger.warn('Kugou getUserPlaylists: missing token or userid')
      return []
    }

    const body = await kugouRequest({
      baseURL: 'https://gateway.kugou.com',
      url: '/v7/get_all_list',
      method: 'POST',
      params: { plat: 1, userid: Number(userid), token },
      data: {
        userid: Number(userid),
        token,
        total_ver: 979,
        type: 2,
        page: 1,
        pagesize: 100,
      },
      encryptType: 'android',
      cookie: { token, userid },
      headers: { 'x-router': 'cloudlist.service.kugou.com' },
    })

    const d = body?.data as Record<string, unknown> | undefined
    const lists = d?.info
    if (!Array.isArray(lists)) {
      logger.warn('Kugou getUserPlaylists: unexpected response', { keys: Object.keys(d || {}) })
      return []
    }

    const mapped: Playlist[] = lists.map((p: Record<string, unknown>) => ({
      id: String(p.global_collection_id || p.listid || p.dirid || ''),
      name: String(p.name || ''),
      cover: String(p.pic || p.img || ''),
      trackCount: Number(p.count ?? p.total ?? 0),
      source: 'kugou' as const,
    }))

    logger.info(`Fetched ${mapped.length} playlists for kugou user ${userid}`)
    return mapped
  } catch (err) {
    logger.error('Kugou getUserPlaylists failed', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Playlist Tracks (via global_collection_id)
// ---------------------------------------------------------------------------

export interface KugouPlaylistTrack {
  hash: string
  filename: string
  album_name?: string
  duration?: number
  privilege?: number
  [key: string]: unknown
}

/**
 * Fetch tracks from a kugou user playlist by global_collection_id.
 * Paginated — pass page (1-based) and pagesize.
 * Returns raw song objects for musicProvider to convert.
 */
export async function getPlaylistTracks(
  playlistId: string,
  page = 1,
  pagesize = 300,
  cookie?: string | null,
): Promise<{ songs: KugouPlaylistTrack[]; total: number }> {
  try {
    const cookieObj = cookie ? parseCookieString(cookie) : {}

    const body = await kugouRequest({
      baseURL: 'https://gateway.kugou.com',
      url: '/pubsongs/v2/get_other_list_file_nofilt',
      method: 'GET',
      params: {
        area_code: 1,
        begin_idx: (page - 1) * pagesize,
        plat: 1,
        type: 1,
        mode: 1,
        personal_switch: 1,
        extend_fields: 'abtags,hot_cmt,popularization',
        pagesize,
        global_collection_id: playlistId,
      },
      encryptType: 'android',
      cookie: cookieObj,
    })

    const d = body?.data as Record<string, unknown> | undefined
    const songs = (d?.songs ?? d?.info) as KugouPlaylistTrack[] | undefined
    const total = Number(d?.count ?? d?.total ?? 0)

    if (!Array.isArray(songs) || songs.length === 0) {
      logger.warn('Kugou getPlaylistTracks: no songs found', {
        playlistId,
        total,
        keys: Object.keys(d || {}),
      })
      return { songs: [], total }
    }

    return { songs, total }
  } catch (err) {
    logger.error('Kugou getPlaylistTracks failed', err)
    return { songs: [], total: 0 }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCookieString(cookie: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of cookie.split(';')) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx < 1) continue
    const key = pair.substring(0, eqIdx).trim()
    const value = pair.substring(eqIdx + 1).trim()
    result[key] = value
  }
  return result
}
