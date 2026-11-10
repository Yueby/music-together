import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'
import { playbackSoundFactory } from './playbackSoundFactory'
import type { PlaybackSoundOptions } from './PlaybackSound'

const native = vi.hoisted(() => {
  const sound = { fixture: 'original-native-instance' }
  return {
    sound,
    constructor: vi.fn(function (options: unknown) {
      void options // Preserve the constructor argument tuple checked by this regression.
      return sound
    }),
  }
})
vi.mock('howler', () => ({ Howl: native.constructor }))
const track: Track = {
  id: 'fixture',
  title: 'Fixture',
  artist: [],
  album: '',
  duration: 120,
  cover: '',
  source: 'netease',
  sourceId: '1',
  urlId: '1',
  streamUrl: 'https://audio.example.test/fixture',
}

beforeEach(() => vi.clearAllMocks())

describe('default Web playback sound factory', () => {
  it('retains native load retry and HTML5 analysis capabilities', () => {
    expect(playbackSoundFactory.allowLoadRetry).toBe(true)
    expect(playbackSoundFactory.supportsHtml5Analysis).toBe(true)
  })

  it('passes the original media options and callbacks directly to Howler', () => {
    const options: PlaybackSoundOptions = {
      src: [track.streamUrl!],
      html5: true,
      format: ['flac', 'm4a', 'ogg', 'mp3'],
      volume: 0,
      onload: vi.fn(),
      onplay: vi.fn(),
      onpause: vi.fn(),
      onend: vi.fn(),
      onloaderror: vi.fn(),
      onplayerror: vi.fn(),
    }
    const sound = playbackSoundFactory.create(track, options)
    expect(native.constructor).toHaveBeenCalledExactlyOnceWith(options)
    expect(native.constructor.mock.calls[0][0]).toBe(options)
    expect(sound).toBe(native.sound)
    expect(options.onload).not.toHaveBeenCalled()
    expect(options.onplay).not.toHaveBeenCalled()
    expect(options.onpause).not.toHaveBeenCalled()
    expect(options.onend).not.toHaveBeenCalled()
  })
})
