import type { HostRuntime } from '../../../../client/src/lib/hostRuntime'

/**
 * Only what the sandbox makes impossible is switched off. Catalog browsing (search, artist pages, albums, playlists)
 * and artwork work like on the Web, through the reviewed metadata endpoints.
 */
export const hostRuntime: HostRuntime = Object.freeze({
  kind: 'mapp',
  // Music-platform login (QR, cookie, own playlists) runs over the reviewed room connection; the login is kept in the
  // SDK's app-scoped storage.
  platformAccounts: true,
  nativeMediaSession: false,
  versionCheck: false,
  // The platform CSP forbids eval, which PixiJS needs; the mesh renderer is plain WebGL.
  pixiBackground: false,
  clipboard: false,
  externalLinks: false,
})
