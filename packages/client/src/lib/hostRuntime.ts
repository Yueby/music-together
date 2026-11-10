/**
 * What the host genuinely cannot do. Every flag here is a platform restriction (no clipboard, no external links, no
 * eval, no browser MediaSession...), not a feature switch: features are built once and work on every host, and a
 * capability only appears here when the host makes it impossible.
 */
export interface HostRuntime {
  readonly kind: 'web' | 'mapp'
  /** Music-platform account login (cookies, QR codes, own playlists). Still to be bridged for the mini-app. */
  readonly platformAccounts: boolean
  readonly nativeMediaSession: boolean
  readonly versionCheck: boolean
  /** PixiJS needs `new Function`; hosts that forbid eval fall back to the mesh gradient renderer. */
  readonly pixiBackground: boolean
  readonly clipboard: boolean
  readonly externalLinks: boolean
}

/** Web defaults retain every existing browser capability. */
export const hostRuntime: HostRuntime = Object.freeze({
  kind: 'web',
  platformAccounts: true,
  nativeMediaSession: true,
  versionCheck: true,
  pixiBackground: true,
  clipboard: true,
  externalLinks: true,
})
