import QRCode from 'qrcode'
import type { Playlist } from '@music-together/shared'
import Meting from '@meting/core'
import { logger } from '../utils/logger.js'

/**
 * QQ 音乐（腾讯）认证服务
 * 使用腾讯统一 xlogin 扫码协议实现 QR 码登录
 *
 * 流程:
 * 1. ptqrshow  → 获取二维码图片 + qrsig cookie
 * 2. ptqrlogin → 轮询扫码状态（需 hash33(qrsig) 计算 ptqrtoken）
 * 3. 登录成功后获取重定向 URL，从中提取最终 cookie
 */

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** QQ 音乐 appid */
const APPID = '716027609'

// ---------------------------------------------------------------------------
// 加密算法
// ---------------------------------------------------------------------------

/**
 * 腾讯 hash33 算法 — 将 qrsig 字符串转为 ptqrtoken 整数
 * 原始 JS: function hash33(t) { for(var e=0,n=0,o=t.length;n<o;++n) e+=(e<<5)+t.charCodeAt(n); return 2147483647&e }
 */
function hash33(qrsig: string): number {
  let hash = 0
  for (let i = 0; i < qrsig.length; i++) {
    hash += (hash << 5) + qrsig.charCodeAt(i)
  }
  return hash & 0x7fffffff
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

    // 登录成功 — 通过 check_sig 获取 p_skey/skey
    if (code === '0') {
      // 标记为正在处理，防止后续轮询干扰
      qrProcessingSet.add(qrsig)

      try {
        // 收集 ptqrlogin 返回的 Set-Cookie
        const loginCookies = collectResponseCookies(response)
        let mergedCookie = mergeCookies(sessionCookie, loginCookies)
        const cookieMap = parseCookieMap(mergedCookie)

        logger.info(`QQ QR: ptqrlogin cookies: [${Array.from(cookieMap.keys()).join(', ')}]`)

        // 提取 uin
        const uin = cookieMap.get('pt2gguin') ?? cookieMap.get('uin') ?? ''

        if (!uin) {
          logger.warn('QQ QR: no uin found in cookies')
          return { status: 803, message: mapped.message, cookie: mergedCookie }
        }

        // 使用 ptuiCB 返回的真实 check_sig URL 获取 p_skey / skey
        if (checkSigUrl && checkSigUrl.startsWith('http')) {
          logger.info('QQ QR: following check_sig from ptqrlogin response...')
          const chainCookies = await followRedirectChain(checkSigUrl, mergedCookie)
          if (chainCookies.length > 0) {
            mergedCookie = mergeCookies(mergedCookie, chainCookies)
            logger.info(`QQ QR: got ${chainCookies.length} cookies from check_sig chain`)
          }
        } else {
          logger.warn('QQ QR: no check_sig URL in ptqrlogin response')
        }

        const finalCookieMap = parseCookieMap(mergedCookie)
        logger.info(`QQ QR: final cookies: [${Array.from(finalCookieMap.keys()).join(', ')}]`)

        const pSkey = finalCookieMap.get('p_skey') ?? ''
        const skey = finalCookieMap.get('skey') ?? ''
        const ptOauthToken = finalCookieMap.get('pt_oauth_token') ?? ''

        logger.info(
          `QQ QR: uin=${uin}, p_skey=${pSkey ? '(found)' : '(missing)'}, skey=${skey ? '(found)' : '(missing)'}`,
        )

        // 尝试通过 OAuth 流程换取 musickey (最优解)
        let musicCookie: string | null = null
        try {
          logger.info('QQ QR: attempting OAuth flow to get musickey...')
          const authCode = await getAuthCode(mergedCookie)
          if (authCode) {
            musicCookie = await fetchMusicKey(authCode)
          }
        } catch (err: unknown) {
          logger.warn('QQ QR: OAuth flow failed', { err })
        }

        if (musicCookie) {
          logger.info(`QQ Music QR login success: ${nickname || uin} (got musickey)`)
          logger.info(`QQ Music QR full cookie: ${musicCookie}`)
          return { status: 803, message: mapped.message, cookie: musicCookie }
        }

        // 尝试直接用 p_skey 换取 (次优解 - 已知失败但保留逻辑)
        if (!musicCookie) {
          // const directMusicCookie = await authLoginWithPSkey(uin, pSkey, skey, ptOauthToken)
          // if (directMusicCookie) musicCookie = directMusicCookie
        }

        // 兜底：直接拼装 cookie
        const cleanUin = uin.replace(/^o0*/, '')
        const fallbackCookie = `uin=${cleanUin}; qm_keyst=${pSkey || skey}; qqmusic_key=${pSkey || skey}; p_skey=${pSkey}; skey=${skey}`
        logger.info(`QQ Music QR login: ${nickname || cleanUin} (fallback cookie)`)
        logger.info(`QQ Music QR full cookie: ${fallbackCookie}`)
        return { status: 803, message: mapped.message, cookie: fallbackCookie }
      } finally {
        // 无论成功还是失败，清理缓存
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

/**
 * 跟随 HTTP 重定向链（最多 maxHops 跳），收集所有 Set-Cookie
 */
async function followRedirectChain(startUrl: string, cookie: string, maxHops = 10): Promise<string[]> {
  const allCookies: string[] = []
  let currentUrl: string | null = startUrl
  let currentCookie = cookie

  for (let hop = 0; hop < maxHops && currentUrl; hop++) {
    const res: Response = await fetch(currentUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Cookie: currentCookie,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })

    const hopCookies = collectResponseCookies(res)
    if (hopCookies.length > 0) {
      allCookies.push(...hopCookies)
      currentCookie = mergeCookies(currentCookie, hopCookies)
    }

    const location: string | null = res.headers.get('location')
    if (!location) {
      logger.info(`QQ QR: redirect chain ended at hop ${hop + 1} (status=${res.status})`)
      break
    }

    logger.info(`QQ QR: redirect hop ${hop + 1}: ${location.slice(0, 80)}`)
    currentUrl = location
  }

  return allCookies
}

/**
 * 从 fetch Response 的 Set-Cookie 头中收集所有 key=value 对
 */
function collectResponseCookies(response: Response): string[] {
  const setCookies = response.headers.getSetCookie?.() ?? []
  const parts: string[] = []
  for (const c of setCookies) {
    const kv = c.split(';')[0] // key=value
    if (kv && !kv.includes('=deleted') && !kv.includes('=;')) {
      const eq = kv.indexOf('=')
      if (eq > 0) {
        const key = kv.slice(0, eq).trim()
        const val = kv.slice(eq + 1).trim()
        if (val) {
          logger.info(`QQ QR cookie collected: ${key}=${val.slice(0, 10)}...`)
          parts.push(kv)
        }
      }
    }
  }
  return parts
}

/**
 * 合并两组 cookie 字符串，后者覆盖前者的同名 key
 */
function mergeCookies(existing: string, newParts: string[]): string {
  const map = new Map<string, string>()
  for (const kv of existing.split('; ')) {
    const eq = kv.indexOf('=')
    if (eq > 0) {
      map.set(kv.slice(0, eq), kv.slice(eq + 1))
    }
  }
  for (const kv of newParts) {
    const eq = kv.indexOf('=')
    if (eq > 0) {
      map.set(kv.slice(0, eq), kv.slice(eq + 1))
    }
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

/**
 * 将 cookie 字符串解析为 key→value Map
 */
function parseCookieMap(cookieStr: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const kv of cookieStr.split('; ')) {
    const eq = kv.indexOf('=')
    if (eq > 0) {
      map.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim())
    }
  }
  return map
}

/**
 * 使用 ptqrlogin 返回的 uin + p_skey/skey 调用 QQ 音乐 AuthLoginCgiServer
 * 直接换取 musickey，绕过 OAuth 流程
 */
async function authLoginWithPSkey(
  uin: string,
  pSkey: string,
  skey: string,
  ptOauthToken: string,
): Promise<string | null> {
  // 清理 uin（去掉前缀 o 和前导 0）
  const cleanUin = uin.replace(/^o0*/, '')
  const key = pSkey || skey

  if (!key) {
    logger.warn('QQ QR: no p_skey or skey available for music login')
    return null
  }

  try {
    // 计算 g_tk（基于 skey / p_skey）
    const gtk = calcGTK(key)

    // 构造登录 cookie
    const loginCookie = [
      `uin=${cleanUin}`,
      `p_skey=${pSkey}`,
      `skey=${skey}`,
      ptOauthToken ? `pt_oauth_token=${ptOauthToken}` : '',
    ]
      .filter(Boolean)
      .join('; ')

    // 调用 QQ 音乐的 musicu.fcg AuthLoginCgiServer
    const data = {
      comm: {
        g_tk: gtk,
        platform: 'yqq',
        ct: 24,
        cv: 0,
      },
      req: {
        module: 'QQConnectLogin.LoginServer',
        method: 'QQLogin',
        param: {
          musicid: Number(cleanUin),
          musickey: key,
          verify_type: 0,
        },
      },
    }

    const response = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Cookie: loginCookie,
        Referer: 'https://y.qq.com/',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10_000),
    })

    const body = (await response.json()) as Record<string, Record<string, Record<string, unknown>>>
    const reqData = body?.req?.data
    logger.info('QQ QR: AuthLoginCgiServer response', { reqData })

    if (reqData?.musickey && reqData?.musicid) {
      const musickey = reqData.musickey as string
      const musicid = reqData.musicid as number
      return `uin=${musicid}; qm_keyst=${musickey}; qqmusic_key=${musickey}`
    }

    // 如果 API 不返回 musickey，直接用 p_skey 作为 qm_keyst
    // 这在很多第三方 QQ 音乐库中可以直接使用
    logger.info('QQ QR: AuthLoginCgiServer did not return musickey, using p_skey as fallback')
    return null
  } catch (err) {
    logger.error('QQ QR authLoginWithPSkey failed', err)
    return null
  }
}

/**
 * 腾讯 g_tk 算法（基于 skey / p_skey）
 */
function calcGTK(skey: string): number {
  let hash = 5381
  for (let i = 0; i < skey.length; i++) {
    hash += (hash << 5) + skey.charCodeAt(i)
  }
  return hash & 0x7fffffff
}

// ---------------------------------------------------------------------------
// 用户信息
// ---------------------------------------------------------------------------

interface QQUserInfoData {
  nickname: string
  vipType: number
  userId: number
}

type GetUserInfoResult = { ok: true; data: QQUserInfoData } | { ok: false; reason: 'expired' | 'error' }

/**
 * 验证 QQ 音乐 cookie 并获取用户信息
 */
export async function getUserInfo(cookie: string): Promise<GetUserInfoResult> {
  try {
    // 从 cookie 解析 uin
    const uinMatch = cookie.match(/uin=(\d+)/)
    const uin = uinMatch?.[1]
    if (!uin) {
      return { ok: false, reason: 'expired' }
    }

    // 调用 QQ 音乐 API 获取用户信息
    const data = {
      comm: {
        ct: 24,
        cv: 0,
        uin,
      },
      req: {
        module: 'userTag.UserTagServer',
        method: 'SrfEntry',
        param: {
          uin: Number(uin),
          IsQuery498: 1,
        },
      },
    }

    const url = `https://u.y.qq.com/cgi-bin/musicu.fcg`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Cookie: cookie,
        Referer: 'https://y.qq.com/',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10_000),
    })

    const body = (await response.json()) as Record<string, Record<string, Record<string, unknown>>>
    const reqData = body?.req?.data as Record<string, unknown> | undefined

    // 尝试提取昵称
    let nickname = `QQ用户${uin}`
    if (reqData?.Name) {
      nickname = reqData.Name as string
    }

    // 检查 VIP 状态 — 使用另一个 API
    const vipType = await checkVipStatus(cookie, uin)

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

/**
 * 检查 QQ 音乐 VIP 状态
 */
async function checkVipStatus(cookie: string, uin: string): Promise<number> {
  try {
    const data = {
      comm: {
        ct: 24,
        cv: 0,
        uin,
      },
      req: {
        module: 'music.UnifiedExpert.UnifiedExpertServer',
        method: 'GetExpertIdentity',
        param: {
          vec_uin: [Number(uin)],
        },
      },
    }

    const response = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        Referer: 'https://y.qq.com/',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10_000),
    })

    const body = (await response.json()) as Record<string, Record<string, Record<string, unknown>>>
    const reqData = body?.req?.data as Record<string, unknown> | undefined

    // VIP 类型: 0=非VIP, 1=绿钻VIP, 2=豪华绿钻
    if (reqData) {
      const identities = reqData.vec_user_identity as Array<Record<string, unknown>> | undefined
      if (identities?.[0]) {
        const isVip = identities[0].is_vip as number | undefined
        return isVip ?? 0
      }
    }
    return 0
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// 用户歌单（已禁用）
// 由于腾讯对服务器端请求的严格反爬策略（500003错误/空响应），
// 且 OAuth 验证码无法在无头环境中解决，
// 暂时禁用此功能以避免日志刷屏。
// ---------------------------------------------------------------------------

export async function getUserPlaylists(_cookie: string): Promise<Playlist[]> {
  // Silent return to avoid log spam
  logger.warn('QQ getUserPlaylists: Feature disabled due to anti-bot restrictions')
  return []
}

/**
 * 使用 cookie 访问 authorize 接口获取 OAuth code
 */
async function getAuthCode(cookie: string): Promise<string | null> {
  try {
    let currentUrl =
      'https://graph.qq.com/oauth2.0/authorize?' +
      new URLSearchParams({
        response_type: 'code',
        client_id: '100497308',
        redirect_uri: 'https://y.qq.com/portal/wx_redirect.html',
        scope: 'get_user_info,get_app_friends',
        state: 'state',
        display: 'mobile',
        g_ut: '1',
      }).toString()

    // 保存初始 authorize URL 用于 xlogin 后重试
    const authorizeUrl = currentUrl
    let visitedXlogin = false

    // 最多跟随 5 次重定向
    for (let i = 0; i < 5; i++) {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          Cookie: cookie,
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      })

      const location = response.headers.get('location')
      if (location) {
        // HTTP 302 Redirect
        const codeMatch = location.match(/code=([^&]+)/)
        if (codeMatch) {
          logger.info(`QQ QR: got OAuth code from authorize redirect (hop ${i + 1})`)
          return codeMatch[1]
        }
        logger.info(`QQ QR: authorize redirect hop ${i + 1}: ${location.slice(0, 80)}`)
        currentUrl = location
        continue
      }

      // Check for HTML meta refresh or JS redirect (200 OK)
      const text = await response.text()
      const metaMatch =
        text.match(/content="\d+;url=([^"]+)"/) ||
        text.match(/location\.replace\("([^"]+)"\)/) ||
        text.match(/location\.href\s*=\s*["']([^"']+)["']/) ||
        text.match(/window\.location\s*=\s*["']([^"']+)["']/)

      if (metaMatch) {
        let redirectUrl = metaMatch[1]
        // Simple HTML entity decode
        redirectUrl = redirectUrl.replace(/&#61;/g, '=').replace(/&amp;/g, '&')
        logger.info(`QQ QR: HTML redirect found at hop ${i + 1}: ${redirectUrl.slice(0, 80)}`)
        currentUrl = redirectUrl
        continue
      }

      // 如果卡在 xlogin 页面，尝试携带 cookie 重新请求 authorize
      if (currentUrl.includes('cgi-bin/xlogin') && !visitedXlogin) {
        logger.info(`QQ QR: hit xlogin page, retrying authorize with new cookies...`)
        visitedXlogin = true
        currentUrl = authorizeUrl
        continue
      }

      logger.warn(`QQ QR: authorize chain ended at hop ${i + 1} without location`, {
        status: response.status,
        textPreview: text.slice(0, 2000),
      })
      break
    }

    return null
  } catch (err: unknown) {
    logger.error('QQ QR getAuthCode failed', { err })
    return null
  }
}

/**
 * 用 OAuth code 换取 QQ 音乐的 musickey
 */
async function fetchMusicKey(code: string): Promise<string | null> {
  try {
    const musicLoginData = {
      comm: {
        g_tk: 5381,
        platform: 'yqq',
        ct: 24,
        cv: 0,
      },
      req: {
        module: 'QQConnectLogin.LoginServer',
        method: 'QQLogin',
        param: {
          code,
          redirect_uri: 'https://y.qq.com/portal/wx_redirect.html',
        },
      },
    }

    const musicRes = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Referer: 'https://y.qq.com/',
      },
      body: JSON.stringify(musicLoginData),
      signal: AbortSignal.timeout(10_000),
    })

    const musicBody = (await musicRes.json()) as Record<string, Record<string, Record<string, unknown>>>
    const reqData = musicBody?.req?.data
    if (reqData?.musickey && reqData?.musicid) {
      const musickey = reqData.musickey as string
      const musicid = reqData.musicid as number
      return `uin=${musicid}; qm_keyst=${musickey}; qqmusic_key=${musickey}`
    }

    logger.warn('QQ QR: music login exchange failed', { reqData })
    return null
  } catch (err: unknown) {
    logger.error('QQ QR fetchMusicKey failed', { err })
    return null
  }
}
