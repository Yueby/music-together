/**
 * A random address inside a mainland-China range (112.88.0.0 – 112.89.35.255).
 *
 * NetEase's anonymous stream endpoint answers `code 404` for most free songs when the request comes from an overseas
 * datacenter address. The client-IP headers below make it treat the request like a mainland one. This is the same
 * workaround the NetEase API SDK offers as `randomCNIP`.
 */
export function randomMainlandIp(random: () => number = Math.random): string {
  const value = 1_884_815_360 + Math.floor(random() * 74_752)
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.')
}
