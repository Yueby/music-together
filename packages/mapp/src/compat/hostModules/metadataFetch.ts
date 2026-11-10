import type { MetadataFetch } from '../../../../client/src/lib/MetadataTransport.ts'
import { getMappHost } from '../hostBinding.ts'

/**
 * `async` on purpose: before binding (or after the host is gone) `getMappHost()` throws, and every caller handles
 * failure through the returned promise (`.then(ok, fail)`, `await` in try/catch) — a synchronous throw would skip it.
 */
export const metadataFetch: MetadataFetch = async (input, init) => getMappHost().metadataFetch(input, init)
