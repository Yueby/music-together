/** Reads at most `maxBytes`; returns undefined as soon as the body is known to be larger. */
export async function readBounded(response: Response, maxBytes: number): Promise<Buffer | undefined> {
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      return undefined
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}
