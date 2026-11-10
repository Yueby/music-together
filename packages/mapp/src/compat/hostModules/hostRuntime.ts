import type { HostRuntime } from '../../../../client/src/lib/hostRuntime'

/** The initial host surface uses approved room, audio, metadata and in-memory adapters. */
export const hostRuntime: HostRuntime = Object.freeze({
  kind: 'mapp',
  platformAccounts: false,
  collections: false,
  nativeMediaSession: false,
  versionCheck: false,
  remoteArtwork: false,
  // The platform CSP forbids eval, which PixiJS needs; the mesh renderer is plain WebGL.
  pixiBackground: false,
  clipboard: false,
  externalLinks: false,
})
