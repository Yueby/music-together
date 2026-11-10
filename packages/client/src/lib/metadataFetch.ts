import type { MetadataFetch } from './MetadataTransport'

/** Default Web transport. Host builds can select a reviewed SDK implementation of this seam. */
export const metadataFetch: MetadataFetch = (input, init) => fetch(input, init)
