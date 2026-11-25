import { describe, expect, it, vi } from 'vitest'
import { readBoundedJson } from './readBounded.js'

describe('readBoundedJson', () => {
  it('parses valid JSON at the byte limit', async () => {
    const text = '{"title":"歌曲"}'
    await expect(readBoundedJson(new Response(text), Buffer.byteLength(text))).resolves.toEqual({ title: '歌曲' })
  })

  it('cancels the stream as soon as it exceeds the byte limit', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('{"data":'))
        controller.enqueue(Buffer.from('"content"}'))
      },
      cancel,
    })

    await expect(readBoundedJson(new Response(body), 10)).rejects.toThrow('JSON response exceeds size limit')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('rejects invalid JSON', async () => {
    await expect(readBoundedJson(new Response('{invalid'))).rejects.toThrow(SyntaxError)
  })
})
