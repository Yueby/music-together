import type { MetadataFetch } from '../../../../client/src/lib/MetadataTransport.ts'
import { getMappHost } from '../hostBinding.ts'

export const metadataFetch: MetadataFetch = (input, init) => getMappHost().metadataFetch(input, init)
