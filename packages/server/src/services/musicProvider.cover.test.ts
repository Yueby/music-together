import Meting from '@meting/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { musicProvider } from './musicProvider.js'

afterEach(() => vi.restoreAllMocks())

const answer = (url: string) => JSON.stringify({ url })

describe('musicProvider.getCover', () => {
  it('asks each platform for its own largest useful size', async () => {
    const pic = vi.spyOn(Meting.prototype, 'pic').mockResolvedValue(answer('https://x/a.jpg'))
    await musicProvider.getCover('netease', 'cover-size-n')
    await musicProvider.getCover('kugou', 'cover-size-k')
    await musicProvider.getCover('tencent', 'cover-size-t', 300)
    expect(pic.mock.calls).toEqual([
      ['cover-size-n', 800],
      ['cover-size-k', 5000],
      ['cover-size-t', 300],
    ])
  })

  it('serves NetEase artwork over https without its size limit, and expands the Kugou size template', async () => {
    vi.spyOn(Meting.prototype, 'pic').mockResolvedValueOnce(answer('http://p1.music.126.net/a==/1.jpg?param=130y130'))
    await expect(musicProvider.getCover('netease', 'cover-norm-n')).resolves.toBe('https://p1.music.126.net/a==/1.jpg')
    vi.spyOn(Meting.prototype, 'pic').mockResolvedValueOnce(answer('http://img.kugou.com/{size}/a.jpg'))
    await expect(musicProvider.getCover('kugou', 'cover-norm-k')).resolves.toBe('http://img.kugou.com/5000/a.jpg')
  })

  it('remembers a cover it found', async () => {
    const pic = vi.spyOn(Meting.prototype, 'pic').mockResolvedValue(answer('https://y.gtimg.cn/a.jpg'))
    await musicProvider.getCover('tencent', 'cover-cache')
    await musicProvider.getCover('tencent', 'cover-cache')
    expect(pic).toHaveBeenCalledOnce()
  })

  it.each([
    ['an unreadable answer', 'not json'],
    ['a timeout', null],
  ])('answers an empty address for %s', async (_name, raw) => {
    vi.spyOn(Meting.prototype, 'pic').mockResolvedValue(raw as string)
    await expect(musicProvider.getCover('tencent', `cover-bad-${String(raw)}`)).resolves.toBe('')
  })

  it('answers an empty address when the call fails', async () => {
    vi.spyOn(Meting.prototype, 'pic').mockRejectedValue(new Error('down'))
    await expect(musicProvider.getCover('tencent', 'cover-fail')).resolves.toBe('')
  })
})
