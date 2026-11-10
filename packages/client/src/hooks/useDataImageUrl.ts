import { dataUrlToBlob } from '@/lib/dataUrl'
import { useEffect, useMemo } from 'react'

function createBlobUrl(dataUrl: string | undefined): string | undefined {
  const blob = dataUrl ? dataUrlToBlob(dataUrl) : null
  if (!blob) return undefined
  try {
    return URL.createObjectURL(blob)
  } catch {
    return undefined
  }
}

/**
 * A `blob:` address for a generated base64 image. Some hosts' CSP allows `blob:` images but not `data:` ones, and a
 * Blob URL works everywhere, so every host shows such pictures (login QR codes) the same way. If a Blob URL cannot
 * be made, the original data URL is returned so a permissive host still shows the picture.
 */
export function useDataImageUrl(dataUrl: string | undefined): string | undefined {
  const blobUrl = useMemo(() => createBlobUrl(dataUrl), [dataUrl])
  useEffect(() => {
    if (!blobUrl) return
    return () => URL.revokeObjectURL(blobUrl)
  }, [blobUrl])
  return blobUrl ?? dataUrl
}
