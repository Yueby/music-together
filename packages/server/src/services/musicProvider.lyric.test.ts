import Meting from '@meting/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ lyricNew: vi.fn(), getKrcByHash: vi.fn() }))
vi.mock('@neteasecloudmusicapienhanced/api', () => ({ default: { lyric_new: mocks.lyricNew } }))
vi.mock('./kugouLyricService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./kugouLyricService.js')>()),
  getKrcByHash: mocks.getKrcByHash,
}))

import { musicProvider } from './musicProvider.js'

const EMPTY = { lyric: '', tlyric: '', romalrc: '', yrc: '' }

beforeEach(() => {
  mocks.lyricNew.mockReset()
  mocks.getKrcByHash.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('musicProvider.getLyric', () => {
  describe('NetEase', () => {
    it('reads the plain, translated, romanised and word-by-word lyric', async () => {
      mocks.lyricNew.mockResolvedValue({
        body: {
          lrc: { lyric: '[00:01.00]a' },
          tlyric: { lyric: '[00:01.00]b' },
          romalrc: { lyric: '[00:01.00]c' },
          yrc: { lyric: '[1000,500](1000,500,0)d' },
        },
      })
      await expect(musicProvider.getLyric('netease', 'n-full')).resolves.toEqual({
        lyric: '[00:01.00]a',
        tlyric: '[00:01.00]b',
        romalrc: '[00:01.00]c',
        yrc: '[1000,500](1000,500,0)d',
      })
    })

    it('fills what the answer lacks with empty text', async () => {
      mocks.lyricNew.mockResolvedValue({ body: { lrc: { lyric: 'only' } } })
      await expect(musicProvider.getLyric('netease', 'n-partial')).resolves.toEqual({ ...EMPTY, lyric: 'only' })
    })

    it('answers an empty lyric, and does not remember it, when there is no body', async () => {
      mocks.lyricNew.mockResolvedValueOnce({}).mockResolvedValueOnce({ body: { lrc: { lyric: 'now' } } })
      await expect(musicProvider.getLyric('netease', 'n-retry')).resolves.toEqual(EMPTY)
      await expect(musicProvider.getLyric('netease', 'n-retry')).resolves.toMatchObject({ lyric: 'now' })
    })

    it('answers an empty lyric when the call fails', async () => {
      mocks.lyricNew.mockRejectedValue(new Error('down'))
      await expect(musicProvider.getLyric('netease', 'n-fail')).resolves.toEqual(EMPTY)
    })

    it('remembers a lyric it found', async () => {
      mocks.lyricNew.mockResolvedValue({ body: { lrc: { lyric: 'once' } } })
      await musicProvider.getLyric('netease', 'n-cache')
      await musicProvider.getLyric('netease', 'n-cache')
      expect(mocks.lyricNew).toHaveBeenCalledOnce()
    })
  })

  describe.each(['tencent', 'kugou'] as const)('%s through Meting', (source) => {
    it('reads the plain and translated lyric', async () => {
      vi.spyOn(Meting.prototype, 'lyric').mockResolvedValue(JSON.stringify({ lyric: 'L', tlyric: 'T' }))
      mocks.getKrcByHash.mockResolvedValue(null)
      await expect(musicProvider.getLyric(source, `${source}-ok`)).resolves.toEqual({
        lyric: 'L',
        tlyric: 'T',
        romalrc: '',
        yrc: '',
      })
    })

    it('answers an empty lyric for an unreadable answer or no answer, without remembering it', async () => {
      const spy = vi.spyOn(Meting.prototype, 'lyric')
      spy.mockResolvedValueOnce('not json').mockResolvedValueOnce(JSON.stringify({ lyric: 'later' }))
      mocks.getKrcByHash.mockResolvedValue(null)
      await expect(musicProvider.getLyric(source, `${source}-bad`)).resolves.toEqual(EMPTY)
      await expect(musicProvider.getLyric(source, `${source}-bad`)).resolves.toMatchObject({ lyric: 'later' })
    })
  })

  describe('Kugou word-by-word lyric', () => {
    it('adds the KRC lines (in milliseconds) when Kugou has them', async () => {
      vi.spyOn(Meting.prototype, 'lyric').mockResolvedValue(JSON.stringify({ lyric: 'L', tlyric: '' }))
      mocks.getKrcByHash.mockResolvedValue({ items: [[{ word: 'a', offset: 1, duration: 0.5 }]] })
      const result = await musicProvider.getLyric('kugou', 'kg-krc')
      expect(result.wordByWord).toHaveLength(1)
      expect(result.wordByWord?.[0].words[0]).toMatchObject({ word: 'a', startTime: 1000, endTime: 1500 })
    })

    it('falls back to the plain lyric when the KRC lookup fails or finds nothing', async () => {
      vi.spyOn(Meting.prototype, 'lyric').mockResolvedValue(JSON.stringify({ lyric: 'L', tlyric: '' }))
      mocks.getKrcByHash.mockRejectedValueOnce(new Error('krc down'))
      await expect(musicProvider.getLyric('kugou', 'kg-fail')).resolves.not.toHaveProperty('wordByWord')
      mocks.getKrcByHash.mockResolvedValueOnce({ items: [] })
      await expect(musicProvider.getLyric('kugou', 'kg-none')).resolves.not.toHaveProperty('wordByWord')
    })
  })
})
