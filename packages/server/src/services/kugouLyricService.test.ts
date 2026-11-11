import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeKrc, getKrcByHash, krcToAmllLines, parseKrc } from './kugouLyricService.js'

const KRC_ENCODE_KEY = Buffer.from([64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105])

function encodeKrc(plainText: string): Buffer {
  const compressed = gzipSync(Buffer.from(plainText))
  const encrypted = Buffer.alloc(compressed.length + 4)
  encrypted.write('krc1')
  for (let i = 0; i < compressed.length; i++) {
    encrypted[i + 4] = compressed[i] ^ KRC_ENCODE_KEY[i % KRC_ENCODE_KEY.length]
  }
  return encrypted
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('krcToAmllLines', () => {
  it('turns word timing in seconds into the line format the lyric player reads, in milliseconds', () => {
    const [line] = krcToAmllLines({
      items: [
        [
          { word: 'a', offset: 1.2, duration: 0.3 },
          { word: 'b', offset: 1.5, duration: 0.5 },
        ],
      ],
    })
    expect(line.words.map((w) => [w.word, w.startTime, w.endTime])).toEqual([
      ['a', 1200, 1500],
      ['b', 1500, 2000],
    ])
    expect(line).toMatchObject({ startTime: 1200, endTime: 2000, isBG: false, isDuet: false })
  })

  it('keeps an empty line as an empty line, and an empty lyric as no lines', () => {
    expect(krcToAmllLines({ items: [[]] })).toEqual([
      { words: [], translatedLyric: '', romanLyric: '', startTime: 0, endTime: 0, isBG: false, isDuet: false },
    ])
    expect(krcToAmllLines({ items: [] })).toEqual([])
  })
})

describe('Kugou KRC service', () => {
  it('parses metadata and word-level timing', () => {
    const parsed = parseKrc('[ti:Song]\n[ar:Artist]\n[1000,2000]<0,500,0>Hello <500,500,0>world')

    expect(parsed).toMatchObject({ title: 'Song', artist: 'Artist' })
    expect(parsed.items).toEqual([
      [
        { word: 'Hello ', offset: 1, duration: 0.5 },
        { word: 'world', offset: 1.5, duration: 0.5 },
      ],
    ])
  })

  it('decodes encrypted compressed KRC content', async () => {
    const plaintext = '[1000,1000]<0,1000,0>Hello'

    await expect(decodeKrc(encodeKrc(plaintext))).resolves.toBe(plaintext)
  })

  it('searches and downloads KRC without legacy request dependencies', async () => {
    const plaintext = '[1000,1000]<0,1000,0>Hello'
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ candidates: [{ id: 'lyric-id', accesskey: 'access-key' }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ fmt: 'krc', content: encodeKrc(plaintext).toString('base64') }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getKrcByHash('song-hash')

    expect(result?.items[0]?.[0]).toEqual({ word: 'Hello', offset: 1, duration: 1 })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/search?')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/download?')
  })
})
