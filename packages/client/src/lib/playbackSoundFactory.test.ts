// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'
import { resetHtmlAudioPoolForTests } from './htmlAudioSound'
import { playbackSoundFactory } from './playbackSoundFactory'
import type { PlaybackSoundOptions } from './PlaybackSound'

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = []
  preload = ''
  src = ''
  volume = 1
  muted = false
  playbackRate = 1
  defaultPlaybackRate = 1
  preservesPitch = false
  currentTime = 0
  duration = 120
  readyState = 0
  paused = true
  ended = false
  buffered = { length: 0, start: () => 0, end: () => 0 }
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
  removeAttribute = vi.fn((name: string) => {
    if (name === 'src') this.src = ''
  })
  load = vi.fn()
  constructor() {
    super()
    FakeAudio.instances.push(this)
  }
}

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

beforeEach(() => {
  FakeAudio.instances = []
  vi.stubGlobal('Audio', FakeAudio)
  resetHtmlAudioPoolForTests()
})

afterEach(() => {
  resetHtmlAudioPoolForTests()
  vi.unstubAllGlobals()
})

describe('default Web playback sound factory', () => {
  it('retains native load retry and HTML5 analysis capabilities', () => {
    expect(playbackSoundFactory.allowLoadRetry).toBe(true)
    expect(playbackSoundFactory.supportsHtml5Analysis).toBe(true)
  })

  it('creates a native HTMLAudio-backed PlaybackSound without firing callbacks synchronously', () => {
    const options: PlaybackSoundOptions = {
      src: [track.streamUrl!],
      html5: true,
      format: ['flac', 'm4a', 'ogg', 'mp3'],
      volume: 0,
      onload: vi.fn(),
      onprogress: vi.fn(),
      onplay: vi.fn(),
      onpause: vi.fn(),
      onend: vi.fn(),
      onloaderror: vi.fn(),
      onplayerror: vi.fn(),
    }
    const sound = playbackSoundFactory.create(track, options)
    expect(sound.state()).toBe('loading')
    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0].src).toBe(track.streamUrl)
    expect(options.onload).not.toHaveBeenCalled()
    expect(options.onprogress).not.toHaveBeenCalled()
    expect(options.onplay).not.toHaveBeenCalled()
    expect(options.onpause).not.toHaveBeenCalled()
    expect(options.onend).not.toHaveBeenCalled()
    sound.unload()
  })
})
