import QRCode from 'qrcode'
import type { Playlist } from '@music-together/shared'
import type { GetUserInfoResult } from './authProvider.js'
import { logger } from '../utils/logger.js'
import { getCookieValue } from '../utils/cookieUtils.js'
import * as crypto from 'node:crypto'

// ---------------------------------------------------------------------------
// Tencent API 响应类型
// ---------------------------------------------------------------------------

interface TencentApiResponse {
  code?: number
  req?: {
    code: number
    data?: Record<string, unknown>
  }
}

interface VipLoginData {
  identity?: {
    vip?: number
    svip?: number
  }
}

interface ProfileData {
  creator?: {
    nick?: string
    name?: string
    encrypt_uin?: string
  }
}

interface MusicKeyData {
  musickey?: string
  musicid?: number
  refresh_token?: string
}

interface PlaylistItem {
  tid?: string | number
  dissid?: string | number
  dirid?: string | number
  dirId?: string | number
  title?: string
  dissname?: string
  dirName?: string
  coverurl?: string
  picurl?: string
  picUrl?: string
  songnum?: number
  dissts?: number
  songNum?: number
}

interface DissInfoData {
  songlist?: Record<string, unknown>[]
  total_song_num?: number
}

/**
 * QQ 音乐（腾讯）认证服务
 * 使用腾讯统一 xlogin 扫码协议实现 QR 码登录
 *
 * 流程优化 (参考 qq-music-download/qqmusic-api-python):
 * 1. ptqrshow  → 获取二维码图片 + qrsig cookie
 * 2. ptqrlogin → 轮询扫码状态（需 hash33(qrsig) 计算 ptqrtoken, GET)
 * 3. check_sig → 拿 p_skey (GET)
 * 4. oauth2.0/authorize → 通过 POST 取 Location 拿到 code
 * 5. QQConnectLogin.LoginServer → 使用 zzc 签名和 code 换取最后的 musickey
 */

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** QQ 音乐 appid */
const APPID = '716027609'
// 新版防爬签名所用的打乱字典
const PART_1_INDEXES = [23, 14, 6, 36, 16, 40, 7, 19].filter((x) => x < 40)
const PART_2_INDEXES = [16, 1, 32, 12, 19, 27, 8, 5]
const SCRAMBLE_VALUES = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179]

// ---------------------------------------------------------------------------
// 加密与签名算法
// ---------------------------------------------------------------------------

/**
 * 腾讯 hash33 算法 — 将 qrsig 字符串转为 ptqrtoken 或 g_tk
 */
function hash33(str: string, initialHash = 0): number {
  let hash = initialHash
  for (let i = 0; i < str.length; i++) {
    hash += (hash << 5) + str.charCodeAt(i)
  }
  return hash & 0x7fffffff
}

/**
 * 腾讯 API 网关通用请求签名 (zzc开头)
 * 移植自 qqmusic-api-python 的 sign.py
 */
function createTencentSign(requestData: unknown): string {
  const jsonStr = JSON.stringify(requestData)
  const hashHex = crypto.createHash('sha1').update(jsonStr).digest('hex').toUpperCase()

  const part1 = PART_1_INDEXES.map((i) => hashHex[i]).join('')
  const part2 = PART_2_INDEXES.map((i) => hashHex[i]).join('')

  const part3 = Buffer.alloc(20)
  for (let i = 0; i < SCRAMBLE_VALUES.length; i++) {
    const v = SCRAMBLE_VALUES[i]
    const hexByteStr = hashHex.substring(i * 2, i * 2 + 2)
    const hashByte = parseInt(hexByteStr, 16)
    part3[i] = v ^ hashByte
  }

  let b64Part = part3.toString('base64')
  b64Part = b64Part.replace(/[\\/+=]/g, '')

  return `zzc${part1}${b64Part}${part2}`.toLowerCase()
}

// ---------------------------------------------------------------------------
// API 请求封装 (Tencent API)
// ---------------------------------------------------------------------------

interface TencentApiConfig {
  module: string
  method: string
  param?: Record<string, unknown>
  cookie?: string
  commExtras?: Record<string, unknown>
}

/**
 * 向 musicu.fcg 接口发送带有底层加密签名的 POST 请求
 */
async function tencentApiRequest<T = Record<string, unknown>>(reqConfig: TencentApiConfig): Promise<T> {
  const data = {
    comm: {
      cv: 4747474,
      ct: 24,
      format: 'json',
      inCharset: 'utf-8',
      outCharset: 'utf-8',
      notice: 0,
      ...reqConfig.commExtras,
    },
    req: {
      module: reqConfig.module,
      method: reqConfig.method,
      param: reqConfig.param || {},
    },
  }

  const sign = createTencentSign(data)
  const url = `https://u.y.qq.com/cgi-bin/musics.fcg?sign=${sign}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Cookie: reqConfig.cookie || '',
      Referer: 'https://y.qq.com/',
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(10_000),
  })

  // 很多时候 QQ 返回的 500003 风控也会带 JSON 或者空体，先拦截非 ok
  if (!response.ok) {
    throw new Error(`Tencent API ${reqConfig.module}.${reqConfig.method} HTTP ${response.status}`)
  }

  const body = (await response.json()) as TencentApiResponse
  const reqRes = body?.req

  if (reqRes?.code !== 0 && reqRes?.code !== undefined) {
    if (reqRes.code === 2000) throw new Error(`[SignInvalidError] API ${reqConfig.method} 签名无效 (2000)`)
    if (reqRes.code === 1000) throw new Error(`[CredentialExpiredError] API ${reqConfig.method} 会话过期 (1000)`)
    throw new Error(`[ResponseCodeError] API ${reqConfig.method} 报错，code：${reqRes?.code}`)
  }

  return (reqRes?.data || body) as T
}

// ---------------------------------------------------------------------------
// QR Code 登录
// ---------------------------------------------------------------------------

/** 服务端缓存 qrsig → 完整 cookie 的映射 */
const qrSessionMap = new Map<string, string>()
/** 正在处理登录的 qrsig 集合（防止重复轮询覆盖 803 状态） */
const qrProcessingSet = new Set<string>()

/**
 * 生成 QQ 音乐扫码登录二维码
 * @returns { key: qrsig 字符串, qrimg: base64 二维码图片 } 或 null
 */
export async function generateQrCode(): Promise<{ key: string; qrimg: string } | null> {
  try {
    const params = new URLSearchParams({
      appid: APPID,
      e: '2',
      l: 'M',
      s: '3',
      d: '72',
      v: '4',
      t: '0.1',
      daid: '383',
      pt_3rd_aid: '100497308',
      u1: 'https://graph.qq.com/oauth2.0/login_jump',
    })

    const url = `https://ssl.ptlogin2.qq.com/ptqrshow?${params.toString()}`

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Referer: 'https://xui.ptlogin2.qq.com/',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      logger.error(`QQ QR ptqrshow failed with status ${response.status}`)
      return null
    }

    // 收集 ptqrshow 返回的所有 cookie（不只是 qrsig）
    const setCookies = response.headers.getSetCookie?.() ?? []
    const cookieParts: string[] = []
    let qrsig = ''

    for (const c of setCookies) {
      const kv = c.split(';')[0]
      if (kv) {
        cookieParts.push(kv)
        const sigMatch = kv.match(/qrsig=(.+)/)
        if (sigMatch) {
          qrsig = sigMatch[1]
        }
      }
    }

    if (!qrsig) {
      // fallback: 尝试从 raw set-cookie header 解析
      const rawCookie = response.headers.get('set-cookie') ?? ''
      const sigMatch = rawCookie.match(/qrsig=([^;]+)/)
      if (sigMatch) {
        qrsig = sigMatch[1]
        cookieParts.push(`qrsig=${qrsig}`)
      }
    }

    if (!qrsig) {
      logger.error('QQ QR: qrsig not found in response headers', {
        setCookieCount: setCookies.length,
        rawSetCookie: response.headers.get('set-cookie')?.slice(0, 200),
      })
      return null
    }

    // 缓存完整 cookie 字符串（供 checkQrStatus 使用）
    const fullCookie = cookieParts.join('; ')
    qrSessionMap.set(qrsig, fullCookie)
    logger.info(`QQ QR: session cookies cached (${cookieParts.length} parts)`)

    // 将二维码图片转为 base64
    const imageBuffer = Buffer.from(await response.arrayBuffer())
    const qrimg = `data:image/png;base64,${imageBuffer.toString('base64')}`

    logger.info('QQ Music QR code generated successfully')
    return { key: qrsig, qrimg }
  } catch (err) {
    logger.error('QQ QR generation failed', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// 状态码映射
// ---------------------------------------------------------------------------

const STATUS_MESSAGES: Record<string, { status: number; message: string }> = {
  '66': { status: 801, message: '等待扫码' },
  '67': { status: 802, message: '已扫码，请在手机上确认' },
  '0': { status: 803, message: '登录成功' },
  '65': { status: 800, message: '二维码已过期，请重新获取' },
}

/**
 * 检查 QQ 音乐扫码状态
 * @param qrsig - generateQrCode 返回的 key（即 qrsig）
 */
export async function checkQrStatus(qrsig: string): Promise<{
  status: number
  message: string
  cookie?: string
}> {
  try {
    // 如果该 qrsig 正在处理登录（check_sig 等耗时操作），直接返回成功状态
    if (qrProcessingSet.has(qrsig)) {
      return { status: 803, message: '登录成功，正在获取用户信息...' }
    }

    const ptqrtoken = hash33(qrsig)

    // 恢复完整 session cookie
    const sessionCookie = qrSessionMap.get(qrsig) ?? `qrsig=${qrsig}`

    const action = `0-0-${Date.now()}`

    const params = new URLSearchParams({
      u1: 'https://graph.qq.com/oauth2.0/login_jump',
      ptqrtoken: String(ptqrtoken),
      ptredirect: '1',
      h: '1',
      t: '1',
      g: '1',
      from_ui: '1',
      ptlang: '2052',
      action,
      js_ver: '24112817',
      js_type: '1',
      pt_uistyle: '40',
      aid: APPID,
      daid: '383',
      pt_3rd_aid: '100497308',
      has_resolve: '1',
    })

    const url = `https://ssl.ptlogin2.qq.com/ptqrlogin?${params.toString()}`

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Referer: 'https://xui.ptlogin2.qq.com/',
        Cookie: sessionCookie,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })

    const text = await response.text()

    // 组合新获得的环境 Cookies（例如下发的 pt2gguin 等）
    const setCookies = response.headers.getSetCookie?.() ?? []
    const cookieMap = new Map<string, string>()
    sessionCookie.split(';').forEach((c) => {
      const parts = c.split('=')
      if (parts.length >= 2) cookieMap.set(parts[0].trim(), parts.slice(1).join('=').trim())
    })
    setCookies.forEach((c) => {
      const kv = c.split(';')[0]
      if (kv) {
        const parts = kv.split('=')
        if (parts.length >= 2) cookieMap.set(parts[0].trim(), parts.slice(1).join('=').trim())
      }
    })
    const mergedCookie = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')

    // 当登录成功（code=0）时输出原始响应方便调试
    if (text.startsWith("ptuiCB('0'")) {
      logger.info(`QQ QR: raw ptqrlogin response: ${text.slice(0, 500)}`)
    }

    // ptuiCB 格式不固定，可能 6~8 个参数，用宽松正则匹配
    const match = text.match(/ptuiCB\('(\d+)','([^']*)','([^']*)','([^']*)','([^']*)'(?:,'([^']*)')?/)
    if (!match) {
      logger.warn('QQ QR: unexpected ptqrlogin response format', { text: text.slice(0, 300) })
      return { status: 800, message: '检查状态失败（响应格式异常）' }
    }

    const [, code, , checkSigUrl, , msg, nickname] = match
    const mapped = STATUS_MESSAGES[code] ?? { status: 800, message: `未知状态 (${code})` }

    logger.info(
      `QQ QR poll: code=${code}, checkSigUrl=${checkSigUrl?.slice(0, 80) || '(empty)'}, nickname=${nickname || '(none)'}`,
    )

    // 登录成功 — 通过 check_sig 获取 p_skey/skey 并换取 OAuth musickey
    if (code === '0') {
      qrProcessingSet.add(qrsig)

      try {
        const uinStr = checkSigUrl?.match(/uin=([^&]+)/)?.[1]
        const ptsigx = checkSigUrl?.match(/ptsigx=([^&]+)/)?.[1]

        if (!uinStr || !ptsigx) {
          logger.warn('QQ QR: Missing uin or ptsigx in check_sig URL')
          return { status: 803, message: mapped.message }
        }

        // 第3步：请求 ptlogin2 的 check_sig 换取 p_skey 和其他全套环境 Cookie
        logger.info('QQ QR: step 3 - fetching p_skey from check_sig')
        const fullCookie = await doCheckSig(uinStr, ptsigx, mergedCookie)

        if (!fullCookie) {
          logger.warn('QQ QR: Failed to pass check_sig')
          return { status: 803, message: mapped.message, cookie: mergedCookie }
        }

        // 从完整的 fullCookie 中切分出 p_skey（给 GTK 哈希使用）
        const pSkeyMatch = fullCookie.match(/p_skey=([^;]+)/)
        const pSkey = pSkeyMatch ? pSkeyMatch[1] : ''
        if (!pSkey) {
          logger.warn('QQ QR: check_sig succeeded but missing p_skey in parsed fullCookie')
        }

        // 第4步：携带包含 p_skey，pt4_token 的全套鉴权上下文发 POST 获取 auth code
        logger.info('QQ QR: step 4 - fetching OAuth code')
        const authCode = await fetchOAuthCode(pSkey, fullCookie)

        if (!authCode) {
          logger.warn('QQ QR: Failed to get OAuth code')
          // fail over 到仅包含 p_skey 的普通 cookie
          const uinInt = Number(uinStr.replace(/^o0*/, ''))
          return {
            status: 803,
            message: mapped.message,
            cookie: `uin=${uinInt}; p_skey=${pSkey}; skey=${pSkey}; qqmusic_key=${pSkey}; qm_keyst=${pSkey}`,
          }
        }

        // 第5步：用获得的 auth code 及 zzc 签名请求换取音乐平台的核心加密票据
        logger.info('QQ QR: step 5 - exchanging code for musickey')
        const finalCookie = await fetchMusicKeySession(authCode)

        if (finalCookie) {
          logger.info(`QQ Music QR login success: ${nickname || uinStr} (got zzc-signed musickey)`)
          return { status: 803, message: mapped.message, cookie: finalCookie }
        }

        // 若第五步失败仍可回退到携带 p_skey 的基础 cookie
        const fallbackUin = Number(uinStr.replace(/^o0*/, ''))
        return {
          status: 803,
          message: mapped.message,
          cookie: `uin=${fallbackUin}; p_skey=${pSkey}; skey=${pSkey}; qqmusic_key=${pSkey}; qm_keyst=${pSkey}`,
        }
      } finally {
        qrProcessingSet.delete(qrsig)
        qrSessionMap.delete(qrsig)
      }
    }

    // 过期时清理缓存
    if (code === '65') {
      qrSessionMap.delete(qrsig)
    }

    return mapped
  } catch (err) {
    logger.error('QQ QR check failed', err)
    return { status: 800, message: '检查状态失败' }
  }
}

// ---------------------------------------------------------------------------
// 用户信息
// ---------------------------------------------------------------------------

// UserInfoData 和 GetUserInfoResult 从 authProvider.ts 统一导入

export async function getUserInfo(cookie: string): Promise<GetUserInfoResult> {
  try {
    const uin = getCookieValue(cookie, 'uin')
    if (!uin) {
      return { ok: false, reason: 'expired' }
    }

    // 以前使用的 userTag.UserTagServer 已被风控拦截且无鉴权。
    // 这里我们直接利用 getEncryptUin 背后用到的 fcg_get_profile_homepage.fcg 接口
    // 它返回的数据中直接包含了 creator.nick
    const url = `https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?ct=20&cv=4747474&cid=205360838&userid=${uin}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Cookie: cookie,
        Referer: 'https://y.qq.com/',
      },
      signal: AbortSignal.timeout(10_000),
    })

    const body = (await response.json()) as { data?: ProfileData }
    const creator = body?.data?.creator || {}

    // 尝试提取昵称，因为 QQ 返回的可能是 Base64 编码的昵称
    let rawNick = creator.nick || creator.name || `QQ用户${uin}`

    // 如果符合 Base64 特征，尝试解码
    if (/^[a-zA-Z0-9+/]+={0,2}$/.test(rawNick) && rawNick.length % 4 === 0) {
      try {
        rawNick = Buffer.from(rawNick, 'base64').toString('utf8')
      } catch {
        // 解码失败则保留原样
      }
    }
    const nickname = rawNick

    // 检查 VIP 状态
    let vipType = 0
    try {
      const vipData = await tencentApiRequest<VipLoginData>({
        module: 'VipLogin.VipLoginInter',
        method: 'vip_login_base',
        cookie,
        param: {},
      })
      logger.info(`QQ VIP Data (vip_login_base): ${JSON.stringify(vipData)}`)
      // vip_login_base 返回的格式中含有 identity.vip 及 identity.svip
      const isVip = vipData?.identity?.svip ? 2 : vipData?.identity?.vip ? 1 : 0
      vipType = isVip
    } catch (err: unknown) {
      logger.error('QQ VIP Check failed:', err instanceof Error ? err.message : String(err))
    }

    return {
      ok: true,
      data: {
        nickname,
        vipType,
        userId: Number(uin),
      },
    }
  } catch (err) {
    logger.error('QQ getUserInfo failed', err)
    return { ok: false, reason: 'error' }
  }
}

// ---------------------------------------------------------------------------
// OAUTH 获取 musickey
// 参考 qqmusic-api-python 的 _authorize_qq_qr
// ---------------------------------------------------------------------------

/**
 * 第3步：使用 ptqrlogin 获取的 sigx 进行 check_sig，取得 `p_skey` 并在返回体附带合并全套新旧 cookie
 */
async function doCheckSig(uinStr: string, sigx: string, baseCookie: string): Promise<string | null> {
  const url =
    `https://ssl.ptlogin2.graph.qq.com/check_sig?` +
    new URLSearchParams({
      uin: uinStr,
      pttype: '1',
      service: 'ptqrlogin',
      nodirect: '0',
      ptsigx: sigx,
      s_url: 'https://graph.qq.com/oauth2.0/login_jump',
      ptlang: '2052',
      ptredirect: '100',
      aid: APPID,
      daid: '383',
      j_later: '0',
      low_login_hour: '0',
      regmaster: '0',
      pt_login_type: '3',
      pt_aid: '0',
      pt_aaid: '16',
      pt_light: '0',
      pt_3rd_aid: '100497308',
    }).toString()

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Referer: 'https://xui.ptlogin2.qq.com/',
      Cookie: baseCookie,
    },
    redirect: 'manual',
  })

  const setCookies = res.headers.getSetCookie?.() ?? []
  if (!setCookies.length) return baseCookie

  // 合并 Cookie，遇到由于过期设置产生的清空操作则直接跳过
  const cookieMap = new Map<string, string>()
  baseCookie.split(';').forEach((c) => {
    const parts = c.split('=')
    if (parts.length >= 2) cookieMap.set(parts[0].trim(), parts.slice(1).join('=').trim())
  })

  setCookies.forEach((c) => {
    const kv = c.split(';')[0]
    const parts = kv.split('=')
    if (parts.length >= 2) {
      const key = parts[0].trim()
      const val = parts.slice(1).join('=').trim()
      if (val) {
        cookieMap.set(key, val)
      }
    }
  })

  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

/**
 * 第4步：向 oauth2.0/authorize 发送 POST 强行截取 Location 中的 code
 */
async function fetchOAuthCode(pSkey: string, fullCookie: string): Promise<string | null> {
  const gtk = hash33(pSkey, 5381)
  const bodyParams = new URLSearchParams({
    response_type: 'code',
    client_id: '100497308',
    redirect_uri: 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/',
    scope: 'get_user_info,get_app_friends',
    state: 'state',
    switch: '',
    from_ptlogin: '1',
    src: '1',
    update_auth: '1',
    openapi: '1010_1030',
    g_tk: String(gtk),
    auth_time: String(Date.now()),
    ui: crypto.randomUUID(),
  })

  // oauth 认证服务器不仅验证 p_skey，而且还验证来源 session 如 pt4_token 等。必须附带全部 cookie 模拟 Python session 行为
  const res = await fetch('https://graph.qq.com/oauth2.0/authorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Cookie: fullCookie,
    },
    body: bodyParams.toString(),
    redirect: 'manual',
  })

  const location = res.headers.get('location')
  if (!location) return null

  const codeMatch = location.match(/code=([^&]+)/)
  return codeMatch ? codeMatch[1] : null
}

/**
 * 第5步：带 zzc 签名和生成的 Code 请求 LoginServer
 */
async function fetchMusicKeySession(code: string): Promise<string | null> {
  try {
    const data = await tencentApiRequest({
      module: 'QQConnectLogin.LoginServer',
      method: 'QQLogin',
      commExtras: { tmeLoginType: '2' },
      param: { code },
    })

    if (data?.musickey && data?.musicid) {
      // 完美提取！生成给 musicProvider / API 都可以通吃的凭证
      return `uin=${data.musicid}; qm_keyst=${data.musickey}; qqmusic_key=${data.musickey}; o_cookie=${data.musicid}; o_refresh_token=${data.refresh_token || ''}`
    }
    return null
  } catch (err) {
    logger.error('QQ QR: MusicKey Session Exchange Failed', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// 用户歌单获取 (基于 zzc 签名防风控)
// ---------------------------------------------------------------------------

/**
 * 获取加密过的 user id (encrypt_uin)
 * 部分歌单和用户信息接口如今不认纯数字 QQ 号
 */
async function getEncryptUin(musicid: string | number): Promise<string> {
  const url = `https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?ct=20&cv=4747474&cid=205360838&userid=${musicid}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://y.qq.com/',
    },
  })
  const data = (await response.json()) as { data?: ProfileData }
  return data?.data?.creator?.encrypt_uin || ''
}

/**
 * 获取 QQ 音乐自建与收藏的完整歌单列表
 */
export async function getUserPlaylists(cookie: string): Promise<Playlist[]> {
  try {
    const uin = getCookieValue(cookie, 'uin')

    if (!uin) {
      logger.warn('QQ getUserPlaylists: missing uin in cookie')
      return []
    }

    const playlists: Playlist[] = []

    // 获取自建歌单
    try {
      const createdData = await tencentApiRequest<{ v_playlist?: PlaylistItem[] }>({
        module: 'music.musicasset.PlaylistBaseRead',
        method: 'GetPlaylistByUin',
        cookie,
        param: { uin },
      })

      const vPlaylist = createdData?.v_playlist || []

      logger.info('QQ Debug Created Playlist Item [0]: \n' + JSON.stringify(vPlaylist[0], null, 2))

      for (const p of vPlaylist) {
        playlists.push({
          id: String(p.tid || p.dissid || p.dirid || p.dirId),
          name: p.title || p.dissname || p.dirName || '未命名歌单',
          cover: p.coverurl || p.picurl || p.picUrl || '',
          trackCount: p.songnum || p.dissts || p.songNum || 0,
          source: 'tencent',
        })
      }
    } catch (err) {
      logger.error('QQ getUserPlaylists (Created) failed', err)
    }

    // 获取收藏歌单
    try {
      const euin = await getEncryptUin(uin)
      if (euin) {
        const favData = await tencentApiRequest<{ v_playlist?: PlaylistItem[] }>({
          module: 'music.musicasset.PlaylistFavRead',
          method: 'CgiGetPlaylistFavInfo',
          cookie,
          param: {
            uin: euin,
            offset: 0,
            size: 100, // 最大100
          },
        })

        const vFavList = favData?.v_playlist || []

        logger.info('QQ Debug Fav Playlist favData parent: \n' + JSON.stringify(favData, null, 2))

        for (const p of vFavList) {
          playlists.push({
            id: String(p.tid || p.dissid || p.dirid || p.dirId),
            name: p.title || p.dissname || p.dirName || '收藏歌单',
            cover: p.coverurl || p.picurl || p.picUrl || '',
            trackCount: p.songnum || p.dissts || p.songNum || 0,
            source: 'tencent',
          })
        }
      }
    } catch (err) {
      logger.error('QQ getUserPlaylists (Favored) failed', err)
    }

    logger.info(`QQ getUserPlaylists: fetched ${playlists.length} playlists for user ${uin}`)
    return playlists
  } catch (err) {
    logger.error('QQ getUserPlaylists failed catastrophically', err)
    return []
  }
}

/**
 * 获取歌单包含的歌曲列表 (music.srfDissInfo.DissInfo -> CgiGetDiss)
 */
export async function getPlaylistTracks(
  playlistId: string,
  page: number,
  limit: number,
  cookie?: string | null,
): Promise<{ songs: Record<string, unknown>[]; total: number }> {
  try {
    const isFav = playlistId === '201'
    let euin = ''
    if (isFav && cookie) {
      const uin = getCookieValue(cookie, 'uin')
      if (uin) {
        euin = await getEncryptUin(uin)
      }
    }

    const data = await tencentApiRequest<DissInfoData>({
      module: 'music.srfDissInfo.DissInfo',
      method: 'CgiGetDiss',
      cookie: cookie || '',
      param: {
        disstid: isFav ? 0 : Number(playlistId),
        dirid: isFav ? 201 : 0,
        tag: true,
        song_begin: limit * (page - 1),
        song_num: limit,
        userinfo: true,
        orderlist: true,
        onlysonglist: false,
        ...(isFav && euin ? { enc_host_uin: euin } : {}),
      },
    })

    const songlist = data?.songlist || []
    const total = data?.total_song_num || songlist.length || 0

    return { songs: songlist, total }
  } catch (err) {
    logger.error(`QQ getPlaylistTracks failed for ${playlistId}`, err)
    return { songs: [], total: 0 }
  }
}
