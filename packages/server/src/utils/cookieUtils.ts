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
