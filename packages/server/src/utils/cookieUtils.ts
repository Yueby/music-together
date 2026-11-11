/**
 * Cookie 字符串解析工具
 * 统一替代 kugouAuthService 和 tencentAuthService 中的重复实现
 */

/**
 * 将 cookie 字符串解析为 key-value 对象
 * @example parseCookieString('token=abc;userid=123') => { token: 'abc', userid: '123' }
 */
export function parseCookieString(cookie: string): Record<string, string> {
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

/** Device fields @meting/core's Kugou playback reads when they are present (all optional). */
const METING_KUGOU_PASSTHROUGH_KEYS = ['mid', 'kg_mid', 'uuid', 'dfid', 'kg_dfid'] as const

/**
 * Convert a stored Kugou login (`token=..;userid=..`, what QR login and this service use) to the cookie shape
 * `@meting/core` needs to resolve a stream URL as the signed-in user: `t=<token>;KugooID=<userid>`.
 * Meting's Kugou `url()` takes the authenticated branch only when BOTH `t` and `KugooID` are set; a cookie that only
 * has `token`/`userid` silently falls back to the anonymous branch (no VIP, no account-only tracks).
 *
 * A cookie that already has `t` and `KugooID` is returned untouched, and one without credentials is returned as it
 * came (nothing to convert), so calling this on any stored Kugou cookie is safe.
 */
export function toMetingKugouCookie(cookie: string): string {
  const parsed = parseCookieString(cookie)
  if (parsed['t'] && parsed['KugooID']) return cookie

  const token = parsed['token'] || parsed['t']
  const userid = parsed['userid'] || parsed['KugooID']
  if (!token || !userid) return cookie

  const pairs = [`t=${token}`, `KugooID=${userid}`]
  for (const key of METING_KUGOU_PASSTHROUGH_KEYS) {
    if (parsed[key]) pairs.push(`${key}=${parsed[key]}`)
  }
  return pairs.join(';')
}

/**
 * 从 cookie 字符串中快速提取单个 key 的值
 * 比 parseCookieString 更高效（无需解析整个字符串）
 * @example getCookieValue('uin=123456; qm_keyst=abc', 'uin') => '123456'
 */
export function getCookieValue(cookie: string, key: string): string | null {
  const regex = new RegExp(`(?:^|;\\s*)${key}=([^;]*)`)
  const match = cookie.match(regex)
  return match ? match[1].trim() : null
}
