// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HowlOptions } from 'howler'
import { EVENTS, type RoomState, type ScheduledPlayState, type Track } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'

const audio = vi.hoisted(() => {
  const instances: ReturnType<typeof createHowl>[] = []
  const handlers = new Map<string, Array<(data: unknown) => void>>()

  function createHowl(options: HowlOptions) {
    let loaded = false
    let playing = false
    const element = document.createElement('audio')
    return {
      _sounds: [{ _node: element }],
      reportProgress: (bufferedTime: number) => {
        Object.defineProperty(element, 'duration', { value: 120 })
        Object.defineProperty(element, 'buffered', { configurable: true, value: { length: 1, end: () => bufferedTime } })
        element.dispatchEvent(new Event('progress'))
      },
      finishLoad: () => {
        loaded = true
        options.onload?.(1)
      },
      failLoad: () => options.onloaderror?.(1, 'LOAD_FAILED'),
      finishPlayback: () => options.onend?.(1),
      state: vi.fn(() => loaded ? 'loaded' : 'loading'),
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
      load: vi.fn(),
      unload: () => unload(),
    }
  }

  const unload = vi.fn()

  return {
    instances,
    handlers,
    fetchLyric: vi.fn(),
    unload,
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
vi.mock('./useLyric', () => ({ useLyric: () => ({ fetchLyric: audio.fetchLyric }) }))
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

function deliver(event: string, data: unknown) {
  act(() => (audio.handlers.get(event) ?? []).forEach((handler) => handler(data)))
}

function deliverPlay() {
  const playState: ScheduledPlayState = {
    isPlaying: true,
    currentTime: 0,
    serverTimestamp: 101_000,
    serverTimeToExecute: 101_000,
    revision: 1,
  }
  deliver(EVENTS.PLAYER_PLAY, { track, playState })
}

function deliverPrepare() {
  deliver(EVENTS.PLAYER_PREPARE, { track, revision: 1, deadlineAt: 103_500 })
}

function setRoom(conductorSocketId = audio.socket.id) {
  useRoomStore.setState({
    room: {
      conductorSocketId,
      currentTrack: null,
      playState: { isPlaying: false, currentTime: 0, serverTimestamp: 100_000, revision: 0 },
    } as RoomState,
  })
}

describe('a PLAYER_PLAY announcement delivered twice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    audio.instances.length = 0
    audio.handlers.clear()
    audio.socket.emit.mockClear()
    audio.fetchLyric.mockClear()
    audio.unload.mockClear()
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

  it('acknowledges a prepared track once and reuses it when PLAY arrives before loading finishes', () => {
    setRoom()
    renderHook(() => usePlayer())
    deliverPrepare()
    deliverPrepare()
    expect(useRoomStore.getState().room).toMatchObject({
      currentTrack: track,
      playState: { isPlaying: false, currentTime: 0, serverTimestamp: 100_000, revision: 1 },
    })
    expect(audio.socket.emit).not.toHaveBeenCalled()

    deliverPlay()
    act(() => {
      audio.instances[0].finishLoad()
      vi.advanceTimersByTime(1_000)
    })
    expect(audio.instances).toHaveLength(1)
    expect(audio.unload).not.toHaveBeenCalled()
    expect(audio.instances[0].play).toHaveBeenCalledOnce()
    expect(audio.socket.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.PLAYER_READY, { trackId: track.id, revision: 1 })
  })

  it('promotes a loaded prefetch and acknowledges PREPARE immediately', () => {
    setRoom()
    renderHook(() => usePlayer())
    deliver(EVENTS.PLAYER_PRELOAD, { track })
    act(() => audio.instances[0].finishLoad())
    deliverPrepare()
    expect(audio.instances).toHaveLength(1)
    expect(audio.socket.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.PLAYER_READY, { trackId: track.id, revision: 1 })
    expect(audio.instances[0].volume).toHaveBeenCalledWith(usePlayerStore.getState().volume)
    expect(audio.instances[0].play).not.toHaveBeenCalled()
  })

  it('forwards HTML5 buffered progress after promoting an in-flight preload', () => {
    setRoom()
    renderHook(() => usePlayer())
    deliver(EVENTS.PLAYER_PRELOAD, { track })
    act(() => audio.instances[0].reportProgress(15))
    expect(usePlayerStore.getState().audioLoadPhase).toBe('idle')

    deliverPrepare()
    act(() => audio.instances[0].reportProgress(30))
    expect(audio.instances).toHaveLength(1)
    expect(usePlayerStore.getState()).toMatchObject({ audioLoadPhase: 'buffering', audioLoadProgress: 0.25 })

    act(() => audio.instances[0].finishLoad())
    expect(usePlayerStore.getState().audioLoadPhase).toBe('idle')
  })

  it.each([false, true])('reuses the sound loaded by room-state recovery (loaded: %s)', (loaded) => {
    setRoom()
    renderHook(() => usePlayer())
    act(() => useRoomStore.getState().updateRoom({
      currentTrack: track,
      playState: { isPlaying: false, currentTime: 0, serverTimestamp: 100_000, revision: 1 },
    }))
    expect(audio.instances).toHaveLength(1)
    if (loaded) act(() => audio.instances[0].finishLoad())

    deliverPrepare()
    if (!loaded) {
      expect(audio.socket.emit).not.toHaveBeenCalled()
      act(() => audio.instances[0].finishLoad())
    }

    expect(audio.instances).toHaveLength(1)
    expect(audio.unload).not.toHaveBeenCalled()
    expect(audio.fetchLyric).toHaveBeenCalledExactlyOnceWith(track)
    expect(audio.socket.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.PLAYER_READY, { trackId: track.id, revision: 1 })
  })

  it.each([false, true])('reports the final outcome of a local load retry (succeeded: %s)', (succeeds) => {
    setRoom()
    renderHook(() => usePlayer())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      deliverPrepare()
      act(() => audio.instances[0].failLoad())
      expect(audio.instances).toHaveLength(2)
      expect(audio.unload).toHaveBeenCalledOnce()
      act(() => audio.instances[0].finishLoad())
      expect(audio.socket.emit).not.toHaveBeenCalled()
      if (succeeds) deliverPlay()
      act(() => {
        if (succeeds) {
          audio.instances[1].finishLoad()
          vi.advanceTimersByTime(1_000)
        } else {
          audio.instances[1].failLoad()
          audio.instances[1].failLoad()
        }
      })
      deliverPrepare()
      expect(audio.instances).toHaveLength(2)
      if (succeeds) expect(audio.instances[1].play).toHaveBeenCalledOnce()
      const ready = { trackId: track.id, revision: 1 }
      expect(audio.socket.emit).toHaveBeenCalledExactlyOnceWith(
        EVENTS.PLAYER_READY,
        succeeds ? ready : { ...ready, failed: true },
      )
    } finally {
      consoleError.mockRestore()
      consoleWarn.mockRestore()
    }
  })

  it('keeps a host stall local and recovers against the room timeline', () => {
    let raf: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      raf = callback
      return 1
    })
    setRoom()
    renderHook(() => usePlayer())
    deliverPlay()
    act(() => {
      audio.instances[0].finishLoad()
      vi.advanceTimersByTime(1_000)
      raf?.(performance.now())
      vi.advanceTimersByTime(8_200)
      raf?.(performance.now())
    })
    expect(audio.socket.emit).not.toHaveBeenCalled()
    expect(audio.instances[0].seek).toHaveBeenCalledWith(8.2, 1)
  })

  it('reports genuine completion from a room member who is not the conductor', () => {
    setRoom('another-socket')
    renderHook(() => usePlayer())
    deliverPlay()
    act(() => {
      audio.instances[0].finishLoad()
      vi.advanceTimersByTime(1_000)
      audio.instances[0].finishPlayback()
    })
    expect(audio.socket.emit).toHaveBeenCalledExactlyOnceWith(
      EVENTS.PLAYER_NEXT, { auto: true, trackId: track.id, revision: 1 },
    )
  })
})
