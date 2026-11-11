import { COVER_HOST_ALLOWLIST } from '@music-together/shared'

/**
 * Some music APIs still hand out `http://` artwork addresses. Browsers block those on an https page (mixed content) and
 * the mini-app's reviewed cover endpoint only accepts https. The known music CDNs serve the same files over https, so
 * upgrade exactly those hosts and leave every other address untouched.
 */
export function httpsCoverUrl(url: string): string {
  if (!url.startsWith('http://')) return url
  try {
    return COVER_HOST_ALLOWLIST.includes(new URL(url).hostname) ? `https://${url.slice('http://'.length)}` : url
  } catch {
    return url
  }
}
