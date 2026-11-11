// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HowlOptions } from 'howler'
import { EVENTS, type ScheduledPlayState, type Track } from '@music-together/shared'
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
      seek: vi.fn((target?: number) => {
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
    usePlayerSync(player.howlRef, player.soundIdRef, player.setDesiredPlayback, player.setScheduledPlayback)
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

  describe('sync response drift correction', () => {
    const respond = (currentTime: number) =>
      act(() =>
        (audio.handlers.get(EVENTS.PLAYER_SYNC_RESPONSE) as unknown as (data: unknown) => void)?.({
          currentTime,
          isPlaying: true,
          serverTimestamp: Date.now(),
        }),
      )
    const seekedTo = (howl: ReturnType<typeof setup>['howl'], target: number) =>
      howl.seek.mock.calls.some(([position]) => position === target)

    it('ignores responses until the server clock is calibrated, so a skewed local clock cannot cause a hard seek', () => {
      audio.clock.calibrated = false
      const { howl } = setup(true)
      act(() => howl.finishLoad())
      expect(howl.playing()).toBe(true)

      respond(90)
      expect(seekedTo(howl, 90)).toBe(false)
      expect(usePlayerStore.getState().syncDrift).toBe(0)
    })

    it('corrects a large cold-start drift once the clock is calibrated', () => {
      const { howl } = setup(true)
      act(() => howl.finishLoad())

      respond(90)
      expect(seekedTo(howl, 90)).toBe(true)
    })

    it('keeps its cold-start state while uncalibrated, so the first calibrated response still corrects immediately', () => {
      audio.clock.calibrated = false
      const { howl } = setup(true)
      act(() => howl.finishLoad())
      respond(90)
      respond(90)

      audio.clock.calibrated = true
      respond(90)
      expect(seekedTo(howl, 90)).toBe(true)
    })
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
