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

export async function readBoundedJson<T = unknown>(response: Response, maxBytes = 2 * 1024 * 1024): Promise<T> {
  const body = await readBounded(response, maxBytes)
  if (!body) throw new Error('JSON response exceeds size limit')
  // Match Response.json(), including its handling of a UTF-8 BOM.
  try {
    return JSON.parse(new TextDecoder().decode(body)) as T
  } catch {
    throw new SyntaxError('Invalid JSON response')
  }
}
