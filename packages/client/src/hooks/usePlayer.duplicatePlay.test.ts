// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HowlOptions } from 'howler'
import { EVENTS, type ScheduledPlayState, type Track } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'

const audio = vi.hoisted(() => {
  const instances: ReturnType<typeof createHowl>[] = []
  const handlers = new Map<string, Array<(data: unknown) => void>>()

  function createHowl(options: HowlOptions) {
    let playing = false
    return {
      finishLoad: () => options.onload?.(1),
      state: vi.fn(() => 'loaded'),
      playing: vi.fn(() => playing),
      play: vi.fn(() => {
        playing = true
        options.onplay?.(1)
        return 1
      }),
      pause: vi.fn(() => {
        playing = false
      }),
      seek: vi.fn(() => 0),
      rate: vi.fn(() => 1),
      duration: vi.fn(() => 120),
      volume: vi.fn(),
      once: vi.fn(),
      unload: vi.fn(),
    }
  }

  return {
    instances,
    handlers,
    Howl: vi.fn(function (options: HowlOptions) {
      const howl = createHowl(options)
      instances.push(howl)
      return howl
    }),
    socket: {
      id: 'test-socket',
      // Every listener is kept, as on a real socket: `usePlayer` and `usePlayerSync` both hear PLAYER_PLAY.
      on: vi.fn((event: string, handler: (data: unknown) => void) => {
        handlers.set(event, [...(handlers.get(event) ?? []), handler])
      }),
      off: vi.fn((event: string, handler: (data: unknown) => void) => {
        handlers.set(
          event,
          (handlers.get(event) ?? []).filter((h) => h !== handler),
        )
      }),
      emit: vi.fn(),
    },
  }
})

vi.mock('howler', () => ({ Howl: audio.Howl }))
vi.mock('@/providers/SocketProvider', () => ({ useSocketContext: () => ({ socket: audio.socket }) }))
vi.mock('@/lib/clockSync', () => ({ getServerTime: () => Date.now(), isCalibrated: () => true, getMedianRTT: () => 0 }))
vi.mock('@/lib/lyricPlayerBridge', () => ({ lyricPlayerBridge: { seek: vi.fn(), setCurrentTime: vi.fn() } }))
vi.mock('./useLyric', () => ({ useLyric: () => ({ fetchLyric: vi.fn() }) }))
vi.mock('./useMediaSession', () => ({ useMediaSession: vi.fn() }))

import { usePlayer } from './usePlayer'

const track: Track = {
  id: 'track-a',
  title: 'Test track',
  artist: ['Test artist'],
  album: '',
  duration: 120,
  cover: '',
  source: 'netease',
  sourceId: '1',
  urlId: '1',
  streamUrl: 'https://audio.example.test/track.mp3',
}

function deliverPlay() {
  const playState: ScheduledPlayState = {
    isPlaying: true,
    currentTime: 0,
    serverTimestamp: 101_000,
    serverTimeToExecute: 101_000,
    revision: 1,
  }
  act(() => (audio.handlers.get(EVENTS.PLAYER_PLAY) ?? []).forEach((handler) => handler({ track, playState })))
}

describe('a PLAYER_PLAY announcement delivered twice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    audio.instances.length = 0
    audio.handlers.clear()
    usePlayerStore.getState().reset()
    useRoomStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('still starts playback at the scheduled time', () => {
    renderHook(() => usePlayer())

    deliverPlay()
    deliverPlay() // repeated delivery of the very same announcement

    act(() => {
      audio.instances[0].finishLoad()
      vi.advanceTimersByTime(1100)
    })

    expect(audio.instances).toHaveLength(1)
    expect(audio.instances[0].play).toHaveBeenCalled()
  })
})
