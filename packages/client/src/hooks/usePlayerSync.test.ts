// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HowlOptions } from 'howler'
import { EVENTS, type RoomState, type ScheduledPlayState, type Track } from '@music-together/shared'
import { useHowl } from './useHowl'
import { usePlayerSync } from './usePlayerSync'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'

const audio = vi.hoisted(() => {
  const instances: ReturnType<typeof createHowl>[] = []
  const handlers = new Map<string, (data: { playState: ScheduledPlayState }) => void>()
  const clock = { calibrated: true }

  function createHowl(options: HowlOptions) {
    let loaded = false
    let playing = false
    let position = 0
    let playbackRate = 1
    return {
      finishLoad() {
        loaded = true
        options.onload?.(1)
      },
      state: vi.fn(() => (loaded ? 'loaded' : 'loading')),
      playing: vi.fn(() => playing),
      play: vi.fn(() => {
        playing = true
        options.onplay?.(1)
        return 1
      }),
      pause: vi.fn(() => {
        playing = false
        options.onpause?.(1)
      }),
      seek: vi.fn<(target?: number, id?: number) => number>((target) => {
        if (target !== undefined) position = target
        return position
      }),
      rate: vi.fn((target?: number) => {
        if (target !== undefined) playbackRate = target
        return playbackRate
      }),
      duration: vi.fn(() => 120),
      volume: vi.fn(),
      once: vi.fn(),
      unload: vi.fn(),
    }
  }

  return {
    instances,
    handlers,
    clock,
    Howl: vi.fn(function (options: HowlOptions) {
      const howl = createHowl(options)
      instances.push(howl)
      return howl
    }),
    socket: {
      id: 'test-socket',
      on: vi.fn((event: string, handler: (data: { playState: ScheduledPlayState }) => void) => {
        handlers.set(event, handler)
      }),
      off: vi.fn((event: string) => handlers.delete(event)),
      emit: vi.fn(),
    },
  }
})

vi.mock('howler', () => ({ Howl: audio.Howl }))
vi.mock('@/providers/SocketProvider', () => ({ useSocketContext: () => ({ socket: audio.socket }) }))
vi.mock('@/lib/clockSync', () => ({
  getServerTime: () => Date.now(),
  isCalibrated: () => audio.clock.calibrated,
  getMedianRTT: () => 0,
}))
vi.mock('@/lib/lyricPlayerBridge', () => ({
  lyricPlayerBridge: { seek: vi.fn(), setCurrentTime: vi.fn() },
}))

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

function dispatch(event: string, overrides: Partial<ScheduledPlayState> = {}) {
  const playState: ScheduledPlayState = {
    isPlaying: true,
    currentTime: 42,
    serverTimestamp: 101_100,
    serverTimeToExecute: 101_100,
    revision: 1,
    ...overrides,
  }
  act(() => audio.handlers.get(event)?.({ playState }))
}

function setup(autoPlay = false) {
  const onTrackEnd = vi.fn()
  const hook = renderHook(() => {
    const player = useHowl(onTrackEnd)
    usePlayerSync(player.howlRef, player.soundIdRef, player.setDesiredPlayback, player.setScheduledPlayback, player.startPlayback)
    return player
  })
  act(() => hook.result.current.loadTrack(track, 42, autoPlay))
  return { ...hook, howl: audio.instances[0] }
}

describe('scheduled playback with loading audio', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    audio.instances.length = 0
    audio.handlers.clear()
    audio.clock.calibrated = true
    usePlayerStore.getState().reset()
    usePlayerStore.getState().setAudioLatencyOffsetMs(null)
    useRoomStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it.each([EVENTS.PLAYER_RESUME, EVENTS.PLAYER_SEEK])('%s waits for the execution time when audio loads early', (event) => {
    const { howl } = setup()
    dispatch(event)

    act(() => {
      vi.advanceTimersByTime(200)
      howl.finishLoad()
    })
    expect(howl.play).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(899))
    expect(howl.play).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(howl.play).toHaveBeenCalledOnce()
    expect(howl.seek).toHaveBeenLastCalledWith(42)
  })

  it.each([EVENTS.PLAYER_RESUME, EVENTS.PLAYER_SEEK])('%s starts once at the elapsed position when audio loads late', (event) => {
    const { howl } = setup()
    dispatch(event)

    act(() => vi.advanceTimersByTime(1100))
    expect(howl.play).not.toHaveBeenCalled()
    expect(howl.seek).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(400)
      howl.finishLoad()
    })
    expect(howl.play).toHaveBeenCalledOnce()
    expect(howl.seek).toHaveBeenLastCalledWith(42.4)
  })

  it('resumes an already loaded track once at the execution time', () => {
    const { howl } = setup()
    act(() => howl.finishLoad())
    dispatch(EVENTS.PLAYER_RESUME)
    expect(howl.play).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1100))
    expect(howl.play).toHaveBeenCalledOnce()
    expect(howl.seek).toHaveBeenLastCalledWith(42)
  })

  it('a pause cancels a pending resume even if loading finishes later', () => {
    const { howl } = setup()
    dispatch(EVENTS.PLAYER_RESUME)
    dispatch(EVENTS.PLAYER_PAUSE, { isPlaying: false, revision: 2 })

    act(() => {
      vi.advanceTimersByTime(1500)
      howl.finishLoad()
    })
    expect(howl.play).not.toHaveBeenCalled()
  })

  it('a newer resume replaces the old target and execution time', () => {
    const { howl } = setup()
    dispatch(EVENTS.PLAYER_RESUME)
    dispatch(EVENTS.PLAYER_RESUME, { currentTime: 60, serverTimeToExecute: 102_000, revision: 2 })

    act(() => {
      vi.advanceTimersByTime(1200)
      howl.finishLoad()
    })
    expect(howl.play).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(800))
    expect(howl.play).toHaveBeenCalledOnce()
    expect(howl.seek).toHaveBeenLastCalledWith(60)
  })

  it('keeps an already playing track running until the scheduled seek without replaying it', () => {
    const { howl } = setup(true)
    act(() => howl.finishLoad())
    expect(howl.play).toHaveBeenCalledOnce()
    dispatch(EVENTS.PLAYER_SEEK, { currentTime: 60 })

    act(() => vi.advanceTimersByTime(1100))
    expect(howl.pause).not.toHaveBeenCalled()
    expect(howl.play).toHaveBeenCalledOnce()
    expect(howl.seek).toHaveBeenLastCalledWith(60, 1)
  })

  it('a paused seek changes position without restarting playback', () => {
    const { howl } = setup(true)
    act(() => howl.finishLoad())
    dispatch(EVENTS.PLAYER_SEEK, { isPlaying: false, currentTime: 60 })
    expect(howl.pause).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1100))
    expect(howl.pause).toHaveBeenCalledOnce()
    expect(howl.play).toHaveBeenCalledOnce()
    expect(howl.seek).toHaveBeenLastCalledWith(60, 1)
  })

  it('does not resume a replaced track from a stale scheduled action', () => {
    const { result, howl } = setup()
    dispatch(EVENTS.PLAYER_RESUME)
    dispatch(EVENTS.PLAYER_PLAY, { revision: 2 })
    act(() => result.current.loadTrack({ ...track, id: 'track-b' }, 0, false))
    const next = audio.instances[1]

    act(() => {
      vi.advanceTimersByTime(1500)
      howl.finishLoad()
      next.finishLoad()
    })
    expect(howl.play).not.toHaveBeenCalled()
    expect(next.play).not.toHaveBeenCalled()
  })

  it('cancels pending playback on unmount', () => {
    const { unmount, howl } = setup()
    dispatch(EVENTS.PLAYER_RESUME)
    unmount()

    act(() => {
      vi.advanceTimersByTime(1500)
      howl.finishLoad()
    })
    expect(howl.play).not.toHaveBeenCalled()
  })

  describe('local authoritative drift sampling', () => {
    function setRoom() {
      useRoomStore.setState({
        room: {
          currentTrack: track,
          conductorSocketId: audio.socket.id,
          playState: { currentTime: 42, serverTimestamp: 100_000, revision: 1, isPlaying: true },
        } as RoomState,
      })
    }

    it('corrects sustained large drift for the conductor without reporting its media position', () => {
      const { howl } = setup(true)
      act(() => {
        setRoom()
        howl.finishLoad()
        vi.advanceTimersByTime(1_750)
      })
      expect(howl.seek).toHaveBeenLastCalledWith(43.75, 1)

      act(() => vi.advanceTimersByTime(13_250))
      expect(audio.socket.emit).toHaveBeenCalledWith(EVENTS.PLAYER_SYNC_REQUEST)
      expect(audio.socket.emit.mock.calls.some(([event]) => event === EVENTS.PLAYER_SYNC)).toBe(false)
    })

    it('waits for clock calibration before collecting drift samples', () => {
      audio.clock.calibrated = false
      const { howl } = setup(true)
      act(() => {
        setRoom()
        howl.finishLoad()
        vi.advanceTimersByTime(2_000)
      })
      expect(howl.seek.mock.calls.some(([, id]) => id === 1)).toBe(false)
      expect(usePlayerStore.getState().syncDrift).toBe(0)
      audio.clock.calibrated = true
      act(() => vi.advanceTimersByTime(1_750))
      expect(howl.seek).toHaveBeenLastCalledWith(45.75, 1)
    })

    it('treats media 200ms ahead as aligned when the device has +200ms compensation', () => {
      const { howl } = setup(true)
      act(() => {
        usePlayerStore.getState().setAudioLatencyOffsetMs(200)
        setRoom()
        howl.finishLoad()
        howl.seek.mockImplementation(() => 42.2 + (Date.now() - 100_000) / 1000)
        vi.advanceTimersByTime(2_000)
      })
      expect(usePlayerStore.getState().syncDrift).toBeCloseTo(0)
      expect(howl.rate.mock.calls.some(([rate]) => rate !== undefined)).toBe(false)
    })

    it('caps WebAudio rate at ±0.3% and crossfades sustained drift above 120ms', () => {
      const { howl } = setup(true)
      let drift = 0.07
      const crossfadeSeek = vi.fn()
      Object.assign(howl, { supportsPitchPreservingRate: false, crossfadeSeek })
      act(() => {
        setRoom()
        howl.finishLoad()
        howl.seek.mockImplementation(() => 42 + (Date.now() - 100_000) / 1000 + drift)
        vi.advanceTimersByTime(1_250)
      })
      expect(howl.rate).toHaveBeenLastCalledWith(0.997)
      expect(crossfadeSeek).not.toHaveBeenCalled()

      drift = -0.07
      act(() => vi.advanceTimersByTime(4_000))
      expect(howl.rate.mock.calls.filter(([rate]) => rate !== undefined).at(-1)).toEqual([1.003])
      expect(crossfadeSeek).not.toHaveBeenCalled()

      drift = 0.25
      act(() => vi.advanceTimersByTime(4_000))
      expect(crossfadeSeek).toHaveBeenCalled()
    })

    it('refreshes the anchor from a newer same-track safety response', () => {
      const { howl } = setup(true)
      act(() => {
        setRoom()
        howl.finishLoad()
        vi.advanceTimersByTime(250)
        const respond = audio.handlers.get(EVENTS.PLAYER_SYNC_RESPONSE) as (data: unknown) => void
        respond({ currentTime: 80, isPlaying: true, serverTimestamp: Date.now(), trackId: track.id })
      })
      expect(useRoomStore.getState().room?.playState.currentTime).toBe(80)
      expect(howl.seek.mock.calls.some(([position]) => position === 80)).toBe(false)
    })
  })

  it('schedules a loaded WebAudio resume on the hardware clock with a compensated target', () => {
    const { howl } = setup()
    const playScheduled = vi.fn((_delay: number, getPosition: () => number) => {
      expect(getPosition()).toBeCloseTo(42.2)
      return 1
    })
    Object.assign(howl, { playScheduled })
    act(() => {
      howl.finishLoad()
      usePlayerStore.getState().setAudioLatencyOffsetMs(200)
    })
    dispatch(EVENTS.PLAYER_RESUME)
    expect(playScheduled).toHaveBeenCalledExactlyOnceWith(1.1, expect.any(Function))
    expect(howl.play).not.toHaveBeenCalled()
  })

  it('executes immediately without a calibrated server clock', () => {
    audio.clock.calibrated = false
    const { howl } = setup()
    act(() => howl.finishLoad())
    dispatch(EVENTS.PLAYER_RESUME)

    act(() => vi.advanceTimersByTime(0))
    expect(howl.play).toHaveBeenCalledOnce()
  })
})
