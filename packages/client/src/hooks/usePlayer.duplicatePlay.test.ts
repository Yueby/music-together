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
      connected: true,
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
    audio.socket.connected = true
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

  it('keeps the playing sound through re-entry with the same track and URL', () => {
    setRoom()
    renderHook(() => usePlayer())
    deliverPlay()
    act(() => {
      audio.instances[0].finishLoad()
      vi.advanceTimersByTime(1100)
      audio.socket.connected = false
      useRoomStore.getState().setConnectionStatus('reconnecting')
    })
    deliver('disconnect', undefined)
    const sound = audio.instances[0]
    expect(sound.playing()).toBe(true)
    sound.seek.mockClear()

    const playState = {
      isPlaying: true,
      currentTime: 2,
      serverTimestamp: 102_000,
      serverTimeToExecute: 102_000,
      revision: 1,
    }
    act(() => {
      audio.socket.connected = true
      useRoomStore.setState({ connectionStatus: 'connected', room: { ...useRoomStore.getState().room!, playState } })
    })
    deliver(EVENTS.PLAYER_PLAY, { track, playState })
    act(() => vi.advanceTimersByTime(1000))
    expect(audio.instances).toHaveLength(1)
    expect(audio.unload).not.toHaveBeenCalled()
    expect(sound.pause).not.toHaveBeenCalled()
    expect(sound.play).toHaveBeenCalledOnce()
    expect(sound.seek.mock.calls.every((args) => args.length === 0)).toBe(true)
  })

  it('does not emit an auto-next or player commands while the room is reconnecting', () => {
    setRoom()
    const player = renderHook(() => usePlayer())
    deliverPlay()
    act(() => {
      audio.instances[0].finishLoad()
      vi.advanceTimersByTime(1100)
      useRoomStore.getState().setConnectionStatus('reconnecting')
      audio.socket.emit.mockClear()
      audio.instances[0].finishPlayback()
      player.result.current.next()
      player.result.current.pause()
    })
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    expect(audio.socket.emit).not.toHaveBeenCalled()
  })

  it('loads the authoritative track when it advanced during the outage', () => {
    setRoom()
    renderHook(() => usePlayer())
    deliverPlay()
    act(() => {
      audio.instances[0].finishLoad()
      vi.advanceTimersByTime(1100)
      useRoomStore.getState().setConnectionStatus('reconnecting')
    })
    deliver('disconnect', undefined)
    const nextTrack = { ...track, id: 'next-track', streamUrl: 'https://audio.example.test/next.mp3' }
    const playState = { isPlaying: true, currentTime: 1, serverTimestamp: 101_100, revision: 2 }
    act(() => useRoomStore.setState({
      room: { ...useRoomStore.getState().room!, currentTrack: nextTrack, playState },
      connectionStatus: 'connected',
    }))
    deliver(EVENTS.PLAYER_PLAY, { track: nextTrack, playState: { ...playState, serverTimeToExecute: 102_000 } })
    expect(audio.instances).toHaveLength(2)
    expect(audio.unload).toHaveBeenCalledOnce()
    expect(usePlayerStore.getState().currentTrack?.id).toBe(nextTrack.id)
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
