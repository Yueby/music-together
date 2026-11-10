export interface HostRuntime {
  readonly kind: 'web' | 'mapp'
  readonly platformAccounts: boolean
  readonly collections: boolean
  readonly nativeMediaSession: boolean
  readonly versionCheck: boolean
  readonly remoteArtwork: boolean
  readonly clipboard: boolean
  readonly externalLinks: boolean
}

/** Web defaults retain every existing browser capability. */
export const hostRuntime: HostRuntime = Object.freeze({
  kind: 'web',
  platformAccounts: true,
  collections: true,
  nativeMediaSession: true,
  versionCheck: true,
  remoteArtwork: true,
  clipboard: true,
  externalLinks: true,
})
