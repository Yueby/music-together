/** Turns a track's cover URL into an address that works as `<img src>` in the current host. */
export interface ArtworkLoader {
  /** True when the cover URL is already usable as-is (Web): no request and no async state. */
  readonly direct: boolean
  load(url: string, signal?: AbortSignal): Promise<string>
}

/** Default Web implementation. A host build can replace this module with a reviewed byte-reading loader. */
export const artworkLoader: ArtworkLoader = {
  direct: true,
  load: (url) => Promise.resolve(url),
}
