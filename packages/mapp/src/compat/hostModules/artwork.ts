import type { ArtworkLoader } from '../../../../client/src/lib/artwork.ts'
import { getMappHost } from '../hostBinding.ts'

export const artworkLoader: ArtworkLoader = {
  direct: false,
  load: (url, signal) => getMappHost().artworkLoader.load(url, signal),
}
