/** Raster image types a QR code or similar generated picture may use. SVG is excluded on purpose (it can carry script). */
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/

/**
 * Turn a base64 image data URL into a Blob without `fetch` (which a locked-down host forbids, even for `data:`).
 * Anything that is not a plain raster base64 data URL is rejected.
 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = IMAGE_DATA_URL.exec(dataUrl)
  if (!match) return null
  let binary: string
  try {
    binary = atob(match[2])
  } catch {
    return null
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: match[1] })
}
