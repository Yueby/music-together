/**
 * The Express `trust proxy` setting, read from the `TRUST_PROXY` environment variable.
 *
 * Behind a reverse proxy (Nginx, Caddy, 1Panel…) the socket peer is always the proxy, so per-IP rate limits would
 * see one single client unless Express is told how many proxies to believe `X-Forwarded-For` from.
 *
 * - unset / empty: `1` — one reverse proxy in front, the layout described in docs/architecture/deployment.md
 * - `false`: trust nothing; use it when port 3001 is reachable directly, otherwise a client can forge its IP
 * - `true`: trust every hop (only for a fully controlled chain)
 * - a number: how many proxies are in front
 * - anything else: passed to Express as is (`loopback`, `10.0.0.0/8, 172.16.0.0/12`…)
 */
export type TrustProxySetting = boolean | number | string

export function parseTrustProxy(raw: string | undefined): TrustProxySetting {
  const value = raw?.trim() ?? ''
  if (value === '') return 1
  const lowered = value.toLowerCase()
  if (lowered === 'true') return true
  if (lowered === 'false') return false
  if (/^\d+$/.test(value)) return Number(value)
  return value
}
