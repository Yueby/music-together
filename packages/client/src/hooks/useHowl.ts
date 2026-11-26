import { useCallback, useEffect, useRef } from 'react'
import type { PlaybackSound, PlaybackSoundOptions } from '@/lib/PlaybackSound'
import { playbackSoundFactory } from '@/lib/playbackSoundFactory'
import type { Track } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import { CURRENT_TIME_THROTTLE_MS, LOAD_COMPENSATION_THRESHOLD_S, MAX_LOAD_COMPENSATION_S } from '@/lib/constants'
import { toast } from 'sonner'
import { lyricPlayerBridge } from '@/lib/lyricPlayerBridge'
import { registerActivePlaybackStop } from '@/lib/audioPlaybackLifecycle'
import { setHowlPosition } from '@/lib/howlPosition'
import { getSoundOutputLatencyMs } from '@/lib/playbackSync'

/** Show local recovery guidance if Howler's unlock is still pending. */
const PLAY_ERROR_TIMEOUT_MS = 3000

/** If playback reports playing() but currentTime doesn't advance for this
 *  many milliseconds, treat it as stalled (network drop mid-stream). */
const STALLED_TIMEOUT_MS = 8000

type LoadSettled = (failed: boolean) => void

/**
 * Manages a Howl audio instance with two-phase loading strategy:
 * Phase 1: Create Howl with volume=0 (silent)
 * Phase 2: onload → seek to target → delay → fade-in unmute
 */
export function useHowl(onTrackEnd: () => void) {
  const howlRef = useRef<PlaybackSound | null>(null)
  const soundIdRef = useRef<number | undefined>(undefined)
  const animFrameRef = useRef<number>(0)
  const syncReadyRef = useRef(false)
  const hardwareStartRef = useRef<{ howl: PlaybackSound; until: number } | null>(null)
  const preloadRef = useRef<{
    track: Track
    sound: PlaybackSound
    callbacks?: PlaybackSoundOptions
  } | null>(null)
  const playErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unlockAttemptRef = useRef(0)
  const lastTimeUpdateRef = useRef(0)
  const stalledRef = useRef<{ lastSeek: number; since: number }>({ lastSeek: -1, since: 0 })
  const trackTitleRef = useRef<string>('')
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const lowFreqUpdateRef = useRef(0)
  const desiredPlaybackRef = useRef<{
    howl: PlaybackSound
    track: Track
    autoPlay: boolean
    getSeekTime?: () => number
    onLoadSettled?: LoadSettled
  } | null>(null)

  // Use selectors for the one reactive value we need (volume sync effect)
  const volume = usePlayerStore((s) => s.volume)

  // Throttled time update loop with stalled detection
  const startTimeUpdate = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    stalledRef.current = { lastSeek: -1, since: 0 }
    const update = () => {
      if (howlRef.current && howlRef.current.playing()) {
        const now = performance.now()
        const seekVal = howlRef.current.seek() as number
        lyricPlayerBridge.setCurrentTime(seekVal)

        if (now - lastTimeUpdateRef.current >= CURRENT_TIME_THROTTLE_MS) {
          lastTimeUpdateRef.current = now
          usePlayerStore.getState().setCurrentTime(seekVal)

          if (analyserRef.current && frequencyDataRef.current && now - lowFreqUpdateRef.current >= 100) {
            lowFreqUpdateRef.current = now
            analyserRef.current.getByteFrequencyData(frequencyDataRef.current)
            const binSize = analyserRef.current.context.sampleRate / analyserRef.current.fftSize
            const startBin = Math.max(0, Math.floor(80 / binSize))
            const endBin = Math.min(frequencyDataRef.current.length - 1, Math.ceil(120 / binSize))
            let total = 0
            for (let bin = startBin; bin <= endBin; bin++) total += frequencyDataRef.current[bin]
            const sampleCount = Math.max(1, endBin - startBin + 1)
            usePlayerStore.getState().setLowFreqVolume(total / sampleCount / 255)
          }

          // Stalled detection: if currentTime hasn't moved for STALLED_TIMEOUT_MS
          // while playing() is true, the stream likely broke mid-playback.
          const st = stalledRef.current
          if (Math.abs(seekVal - st.lastSeek) < 0.05) {
            if (st.since > 0 && now - st.since > STALLED_TIMEOUT_MS) {
              toast.error('本机播放中断，正在尝试重新同步')
              stalledRef.current = { lastSeek: seekVal, since: now }
              const target = desiredPlaybackRef.current?.getSeekTime?.()
              if (target !== undefined && target < howlRef.current.duration()) {
                setHowlPosition(howlRef.current, target, soundIdRef.current)
              }
            }
            // still stalled but not timed out yet — keep since
          } else {
            // time moved — reset stalled tracker
            stalledRef.current = { lastSeek: seekVal, since: now }
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(update)
    }
    animFrameRef.current = requestAnimationFrame(update)
  }, [])

  const stopTimeUpdate = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
  }, [])

  const discardPreload = useCallback(() => {
    const preload = preloadRef.current
    preloadRef.current = null
    preload?.sound.unload()
  }, [])

  const preloadTrack = useCallback((track: Track) => {
    // The mini-app factory prefetches compressed bytes via the platform SDK.
    if (!playbackSoundFactory.supportsHtml5Analysis && playbackSoundFactory.preload) {
      playbackSoundFactory.preload(track)
      return
    }
    if (!track.streamUrl) return
    const previous = preloadRef.current
    if (previous?.track.id === track.id && previous.track.streamUrl === track.streamUrl) return
    discardPreload()
    const sound = playbackSoundFactory.create(track, {
      src: [track.streamUrl],
      html5: true,
      preload: true,
      autoplay: false,
      format: ['flac', 'm4a', 'ogg', 'mp3'],
      volume: 0,
      onload: () => preload.callbacks?.onload?.(),
      onprogress: (info) => preload.callbacks?.onprogress?.(info),
      onloaderror: (id, error) => {
        if (preload.callbacks) preload.callbacks.onloaderror?.(id, error)
        else if (preloadRef.current === preload) discardPreload()
      },
      onplay: () => preload.callbacks?.onplay?.(),
      onplayerror: (id, error) => preload.callbacks?.onplayerror?.(id, error),
      onpause: () => preload.callbacks?.onpause?.(),
      onend: () => preload.callbacks?.onend?.(),
    })
    const preload: NonNullable<typeof preloadRef.current> = { track, sound }
    preloadRef.current = preload
  }, [discardPreload])

  const reuseTrackLoad = useCallback((track: Track, onLoadSettled: LoadSettled) => {
    const active = desiredPlaybackRef.current
    if (!active || active.track.id !== track.id || active.track.streamUrl !== track.streamUrl) return false
    const state = active.howl.state()
    if (state === 'unloaded') return false

    active.autoPlay = false
    if (state === 'loaded') {
      active.getSeekTime = undefined
      if (active.howl.playing()) active.howl.pause(soundIdRef.current)
      setHowlPosition(active.howl, 0, soundIdRef.current)
      if (active.howl.rate() !== 1) active.howl.rate(1)
      usePlayerStore.getState().setCurrentTime(0)
      onLoadSettled(false)
    } else {
      active.getSeekTime = () => 0
      active.onLoadSettled = onLoadSettled
    }
    return true
  }, [])

  // Load and play a track
  const loadTrack = useCallback(
    function loadTrack(
      track: Track,
      seekTo?: number,
      autoPlay = true,
      onLoadSettled?: LoadSettled,
      retry?: { startedAt: number; getSeekTime?: () => number },
    ) {
      if (playErrorTimerRef.current) {
        clearTimeout(playErrorTimerRef.current)
        playErrorTimerRef.current = null
      }

      const previous = howlRef.current
      ++unlockAttemptRef.current
      howlRef.current = null
      hardwareStartRef.current = null
      stopTimeUpdate()
      syncReadyRef.current = false
      soundIdRef.current = undefined
      analyserRef.current?.disconnect()
      void audioContextRef.current?.close()
      analyserRef.current = null
      audioContextRef.current = null
      frequencyDataRef.current = null
      usePlayerStore.getState().setLowFreqVolume(1)
      usePlayerStore.getState().setDetectedAudioLatencyMs(0)
      trackTitleRef.current = track.title

      const { setAudioLoadState, setCurrentTime, setDuration, setIsPlaying, setCurrentTrack } = usePlayerStore.getState()
      setCurrentTrack(track)
      setIsPlaying(false)
      if (!track.streamUrl) {
        previous?.unload()
        desiredPlaybackRef.current = null
        setAudioLoadState({ phase: 'idle' })
        onLoadSettled?.(true)
        return
      }

      const loadStartTime = retry?.startedAt ?? Date.now()
      setAudioLoadState({ phase: 'buffering', progress: null, loadedBytes: null, startedAt: loadStartTime })
      setCurrentTime(seekTo ?? 0)
      setDuration(Number.isFinite(track.duration) && track.duration > 0 ? track.duration : 0)

      let initialized = false
      const settleLoad = (failed: boolean) => {
        const active = desiredPlaybackRef.current
        if (active?.howl !== howl) return
        const callback = active.onLoadSettled
        active.onLoadSettled = undefined
        callback?.(failed)
      }
      const callbacks: PlaybackSoundOptions = {
        src: [track.streamUrl],
        html5: true,
        format: ['flac', 'm4a', 'ogg', 'mp3'],
        volume: 0,
        onprogress: (info) => {
          if (howlRef.current !== howl || initialized) return
          setAudioLoadState({
            phase: info.phase,
            progress: info.progress ?? null,
            loadedBytes: info.loadedBytes ?? null,
          })
        },
        onload: () => {
          if (howlRef.current !== howl || initialized) return
          initialized = true
          setAudioLoadState({ phase: 'idle' })
          const d = howl.duration()
          if (Number.isFinite(d) && d > 0) {
            usePlayerStore.getState().setDuration(d)
          }
          // MediaElementAudioSource 会将未提供 CORS 许可的跨域音频强制静音。
          // 因此只对同源流启用分析器；第三方 CDN 音频保持 Howler 原始播放链路。
          const isSameOriginStream = (() => {
            try {
              return new URL(track.streamUrl!, window.location.href).origin === window.location.origin
            } catch {
              return false
            }
          })()

          if (playbackSoundFactory.supportsHtml5Analysis && isSameOriginStream) {
            const audioElement = howl.claimMediaElementForAnalysis?.()
            if (audioElement && typeof AudioContext !== 'undefined') {
              try {
                const context = new AudioContext()
                const analyser = context.createAnalyser()
                analyser.fftSize = 2048
                analyser.smoothingTimeConstant = 0.8
                const source = context.createMediaElementSource(audioElement)
                source.connect(analyser)
                analyser.connect(context.destination)
                analyserRef.current = analyser
                audioContextRef.current = context
                frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount)
              } catch {
                // 分析器不可用时不影响播放，背景使用 AMLL 默认低频值。
              }
            }
          }

          usePlayerStore.getState().setDetectedAudioLatencyMs(getSoundOutputLatencyMs(howl))
          settleLoad(false)
          if (desiredPlaybackRef.current?.howl !== howl) return
          if (desiredPlaybackRef.current.autoPlay) {
            const scheduledSeekTarget = desiredPlaybackRef.current.getSeekTime?.()
            const elapsed = (Date.now() - loadStartTime) / 1000
            const seekTarget =
              scheduledSeekTarget ?? (seekTo ?? 0) + Math.min(elapsed, MAX_LOAD_COMPENSATION_S)
            if (seekTarget > 0) {
              // Update store immediately so AMLL lyrics jump to correct position
              usePlayerStore.getState().setCurrentTime(seekTarget)
              howl.seek(seekTarget)
            }
            const soundId = howl.playScheduled && desiredPlaybackRef.current.getSeekTime
              ? howl.playScheduled(0, desiredPlaybackRef.current.getSeekTime)
              : howl.play()
            soundIdRef.current = soundId
            howl.once('play', (playedSoundId) => {
              if (howlRef.current !== howl || playedSoundId !== soundId) return
              const correctedTime = desiredPlaybackRef.current?.getSeekTime?.() ?? seekTarget
              if (
                desiredPlaybackRef.current?.autoPlay && !howl.playScheduled &&
                (scheduledSeekTarget !== undefined || elapsed > LOAD_COMPENSATION_THRESHOLD_S) &&
                Math.abs((howl.seek(undefined, playedSoundId) as number) - correctedTime) > 0.03
              ) {
                setHowlPosition(howl, correctedTime, playedSoundId)
              }
              const latestVolume = usePlayerStore.getState().volume
              howl.volume(latestVolume)
              syncReadyRef.current = true
            })
          } else {
            const pausedTarget = desiredPlaybackRef.current.getSeekTime?.() ?? seekTo ?? 0
            if (desiredPlaybackRef.current.getSeekTime || pausedTarget > 0) howl.seek(pausedTarget)
            // Read the volume at the moment of unmuting; the user may have dragged
            // the slider while the stream was loading.
            howl.volume(usePlayerStore.getState().volume)
            usePlayerStore.getState().setCurrentTime(pausedTarget)
            syncReadyRef.current = true
          }
        },
        onplay: () => {
          if (howlRef.current !== howl) return
          ++unlockAttemptRef.current
          if (playErrorTimerRef.current) clearTimeout(playErrorTimerRef.current)
          playErrorTimerRef.current = null
          usePlayerStore.getState().setDetectedAudioLatencyMs(getSoundOutputLatencyMs(howl))
          setAudioLoadState({ phase: 'idle' })
          usePlayerStore.getState().setIsPlaying(true)
          const dur = howl.duration()
          if (Number.isFinite(dur) && dur > 0) {
            usePlayerStore.getState().setDuration(dur)
          }
          startTimeUpdate()
        },
        onpause: () => {
          if (howlRef.current !== howl) return
          usePlayerStore.getState().setIsPlaying(false)
          stopTimeUpdate()
        },
        onend: () => {
          if (howlRef.current !== howl) return
          usePlayerStore.getState().setIsPlaying(false)
          stopTimeUpdate()
          onTrackEnd()
        },
        onloaderror: () => {
          const active = desiredPlaybackRef.current
          if (active?.howl !== howl) return
          if (playbackSoundFactory.allowLoadRetry && !retry) {
            // Howler's load() adds a second media node and can later select the failed one for playback.
            console.warn('Howl load error, retrying')
            loadTrack(track, seekTo, active.autoPlay, active.onLoadSettled, {
              startedAt: loadStartTime,
              getSeekTime: active.getSeekTime,
            })
            return
          }
          setAudioLoadState({ phase: 'idle' })
          console.error('Howl load failed')
          toast.error(`本机无法加载「${trackTitleRef.current}」`)
          settleLoad(true)
          howlRef.current = null
          desiredPlaybackRef.current = null
          usePlayerStore.getState().setDetectedAudioLatencyMs(0)
          howl.unload()
        },
        onplayerror: function (soundId: number) {
          if (howlRef.current !== howl || !desiredPlaybackRef.current?.autoPlay) return
          const attempt = ++unlockAttemptRef.current
          // Keep the unlock listener active after showing local recovery guidance.
          if (playErrorTimerRef.current) clearTimeout(playErrorTimerRef.current)
          playErrorTimerRef.current = setTimeout(() => {
            playErrorTimerRef.current = null
            if (attempt !== unlockAttemptRef.current || !desiredPlaybackRef.current?.autoPlay) return
            usePlayerStore.getState().setIsPlaying(false)
            usePlayerStore.getState().setAudioLoadState({ phase: 'idle' })
            toast.error('本机播放受阻，请与页面交互后重试')
          }, PLAY_ERROR_TIMEOUT_MS)
          howl.once('unlock', () => {
            if (attempt !== unlockAttemptRef.current || howlRef.current !== howl ||
                !desiredPlaybackRef.current?.autoPlay) return
            ++unlockAttemptRef.current
            if (playErrorTimerRef.current) {
              clearTimeout(playErrorTimerRef.current)
              playErrorTimerRef.current = null
            }
            const getSeekTime = desiredPlaybackRef.current.getSeekTime
            if (howl.playScheduled && getSeekTime) {
              soundIdRef.current = howl.playScheduled(0, getSeekTime)
            } else {
              if (getSeekTime) setHowlPosition(howl, getSeekTime(), soundId)
              howl.play(soundId)
              if (getSeekTime) {
                howl.once('play', (id) => {
                  if (howlRef.current === howl && desiredPlaybackRef.current?.autoPlay && id === soundId) {
                    setHowlPosition(howl, getSeekTime(), id)
                  }
                })
              }
            }
          })
        },
      }
      const preload = preloadRef.current
      const promoted = preload?.track.id === track.id && preload.track.streamUrl === track.streamUrl
      const howl = promoted ? preload.sound : playbackSoundFactory.create(track, callbacks)
      if (promoted) {
        preloadRef.current = null
        preload.callbacks = callbacks
      }
      // The mini-app factory may transfer a decoded buffer while creating the next handle.
      if (previous !== howl) previous?.unload()
      desiredPlaybackRef.current = { howl, track, autoPlay, onLoadSettled, getSeekTime: retry?.getSeekTime }
      howlRef.current = howl
      if (howl.state() === 'loaded') {
        if (promoted) callbacks.onload?.()
        else settleLoad(false)
      }
    },
    [onTrackEnd, startTimeUpdate, stopTimeUpdate],
  )

  const setDesiredPlayback = useCallback((shouldPlay: boolean, getSeekTime?: () => number) => {
    if (!desiredPlaybackRef.current) return
    if (!shouldPlay) ++unlockAttemptRef.current
    desiredPlaybackRef.current.autoPlay = shouldPlay
    const hardwareStart = hardwareStartRef.current
    if (!shouldPlay && hardwareStart) {
      hardwareStartRef.current = null
      if (performance.now() < hardwareStart.until || !hardwareStart.howl.playing()) {
        hardwareStart.howl.pause(soundIdRef.current)
      }
    }
    if (getSeekTime) desiredPlaybackRef.current.getSeekTime = getSeekTime
    else if (!shouldPlay) desiredPlaybackRef.current.getSeekTime = undefined
  }, [])

  /** Set the authoritative play target without queuing duplicate Howler play calls. */
  const setScheduledPlayback = useCallback((getSeekTime: () => number) => {
    const desired = desiredPlaybackRef.current
    if (!desired) return
    desired.autoPlay = true
    desired.getSeekTime = getSeekTime
  }, [])

  /** Start the current Howl at an authoritative position, or defer until load. */
  const startPlayback = useCallback((getSeekTime: () => number, delayMs = 0) => {
    const desired = desiredPlaybackRef.current
    const howl = howlRef.current
    if (!desired || !howl || desired.howl !== howl) return

    desired.autoPlay = true
    desired.getSeekTime = getSeekTime
    if (howl.state() !== 'loaded') return

    if (howl.playScheduled) {
      hardwareStartRef.current = delayMs > 0 ? { howl, until: performance.now() + delayMs } : null
      if (howl.rate() !== 1) howl.rate(1)
      soundIdRef.current = howl.playScheduled(delayMs / 1000, getSeekTime)
      return
    }

    const targetTime = getSeekTime()
    if (howl.rate() !== 1) howl.rate(1)
    howl.seek(targetTime)
    const soundId = soundIdRef.current !== undefined ? howl.play(soundIdRef.current) : howl.play()
    soundIdRef.current = soundId
    howl.once('play', (playedSoundId) => {
      if (howlRef.current !== howl || desiredPlaybackRef.current !== desired ||
          !desired.autoPlay || desired.getSeekTime !== getSeekTime || playedSoundId !== soundId) return
      const correctedTime = getSeekTime()
      if (Math.abs((howl.seek(undefined, playedSoundId) as number) - correctedTime) > 0.03) {
        setHowlPosition(howl, correctedTime, playedSoundId)
      }
    })
  }, [])

  const stopAndUnload = useCallback(() => {
    usePlayerStore.getState().setAudioLoadState({ phase: 'idle' })
    usePlayerStore.getState().setDetectedAudioLatencyMs(0)
    discardPreload()
    hardwareStartRef.current = null
    if (playErrorTimerRef.current) clearTimeout(playErrorTimerRef.current)
    playErrorTimerRef.current = null
    desiredPlaybackRef.current = null
    ++unlockAttemptRef.current
    soundIdRef.current = undefined
    if (howlRef.current) {
      try {
        howlRef.current.unload()
      } catch {
        /* ignore */
      }
      howlRef.current = null
    }
    stopTimeUpdate()
  }, [discardPreload, stopTimeUpdate])

  useEffect(() => registerActivePlaybackStop(stopAndUnload), [stopAndUnload])

  // Volume sync
  useEffect(() => {
    if (howlRef.current && syncReadyRef.current) {
      howlRef.current.volume(volume)
    }
  }, [volume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAndUnload()
      analyserRef.current?.disconnect()
      void audioContextRef.current?.close()
      analyserRef.current = null
      audioContextRef.current = null
      frequencyDataRef.current = null
      usePlayerStore.getState().setLowFreqVolume(1)
    }
  }, [stopAndUnload])

  return {
    howlRef,
    soundIdRef,
    loadTrack,
    reuseTrackLoad,
    preloadTrack,
    setDesiredPlayback,
    setScheduledPlayback,
    startPlayback,
    stopAndUnload,
  }
}
