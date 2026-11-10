import { describe, expect, it } from 'vitest'
import { dataUrlToBlob } from './dataUrl'

// "PNG" in base64.
const PNG = 'data:image/png;base64,UE5H'

describe('dataUrlToBlob', () => {
  it('decodes a base64 raster data URL without fetch', async () => {
    const blob = dataUrlToBlob(PNG)
    expect(blob?.type).toBe('image/png')
    expect(await blob!.text()).toBe('PNG')
  })

  it.each(['image/jpeg', 'image/gif', 'image/webp'])('accepts %s', (type) => {
    expect(dataUrlToBlob(`data:${type};base64,UE5H`)?.type).toBe(type)
  })

  it.each([
    ['svg (can carry script)', 'data:image/svg+xml;base64,UE5H'],
    ['a non-image type', 'data:text/html;base64,UE5H'],
    ['an unencoded payload', 'data:image/png,PNG'],
    ['a remote URL', 'https://example.test/qr.png'],
    ['a blob URL', 'blob:https://example.test/abc'],
    ['an empty string', ''],
    ['trailing junk', `${PNG}"onload="x`],
    ['an invalid base64 length', 'data:image/png;base64,A'],
  ])('rejects %s', (_name, value) => {
    expect(dataUrlToBlob(value)).toBeNull()
  })
})
