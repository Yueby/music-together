import { useCallback, useEffect, useRef } from 'react'
import type { PlaybackSound } from '@/lib/PlaybackSound'
import { playbackSoundFactory } from '@/lib/playbackSoundFactory'
import type { Track } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import { CURRENT_TIME_THROTTLE_MS, LOAD_COMPENSATION_THRESHOLD_S, MAX_LOAD_COMPENSATION_S } from '@/lib/constants'
import { toast } from 'sonner'
import { lyricPlayerBridge } from '@/lib/lyricPlayerBridge'
import { registerActivePlaybackStop } from '@/lib/audioPlaybackLifecycle'
import { setHowlPosition } from '@/lib/howlPosition'

/** Max wait (ms) for Howler `unlock` event before giving up and skipping */
const PLAY_ERROR_TIMEOUT_MS = 3000

/** If playback reports playing() but currentTime doesn't advance for this
 *  many milliseconds, treat it as stalled (network drop mid-stream). */
const STALLED_TIMEOUT_MS = 8000

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
  const unmuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTimeUpdateRef = useRef(0)
  const stalledRef = useRef<{ lastSeek: number; since: number }>({ lastSeek: -1, since: 0 })
  const trackTitleRef = useRef<string>('')
  const retryRef = useRef(false)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const lowFreqUpdateRef = useRef(0)
  const desiredPlaybackRef = useRef<{
    howl: PlaybackSound
    autoPlay: boolean
    getSeekTime?: () => number
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
              console.warn('Playback stalled, skipping track')
              toast.error('播放中断，已跳到下一首')
              stalledRef.current = { lastSeek: -1, since: 0 }
              onTrackEnd()
              return
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
  }, [onTrackEnd])

  const stopTimeUpdate = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
  }, [])

  // Load and play a track
  const loadTrack = useCallback(
    (track: Track, seekTo?: number, autoPlay = true) => {
      if (unmuteTimerRef.current) {
        clearTimeout(unmuteTimerRef.current)
        unmuteTimerRef.current = null
      }
      // Clear any pending play-error timeout from the previous track so it
      // doesn't fire onTrackEnd() and skip the new track being loaded.
      if (playErrorTimerRef.current) {
        clearTimeout(playErrorTimerRef.current)
        playErrorTimerRef.current = null
      }

      if (howlRef.current) {
        try {
          howlRef.current.unload()
        } catch {
          /* ignore */
        }
        howlRef.current = null
        stopTimeUpdate()
      }

      syncReadyRef.current = false
      soundIdRef.current = undefined
      analyserRef.current?.disconnect()
      void audioContextRef.current?.close()
      analyserRef.current = null
      audioContextRef.current = null
      frequencyDataRef.current = null
      usePlayerStore.getState().setLowFreqVolume(1)
      trackTitleRef.current = track.title
      retryRef.current = false

      if (!track.streamUrl) return

      const loadStartTime = Date.now()
      const currentVolume = usePlayerStore.getState().volume

      const desiredPlayback = { howl: null as unknown as PlaybackSound, autoPlay, getSeekTime: undefined as (() => number) | undefined }
      const howl = playbackSoundFactory.create(track, {
        src: [track.streamUrl],
        html5: true,
        format: ['flac', 'm4a', 'ogg', 'mp3'],
        volume: 0,
        onload: () => {
          if (howlRef.current !== howl) return // Stale instance guard
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
            const sound = (howl as unknown as { _sounds?: Array<{ _node?: HTMLAudioElement }> })._sounds?.[0]
            const audioElement = sound?._node
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
            const soundId = howl.play()
            soundIdRef.current = soundId
            howl.once('play', (playedSoundId) => {
              if (howlRef.current !== howl || playedSoundId !== soundId) return
              const correctedTime = desiredPlaybackRef.current?.getSeekTime?.() ?? seekTarget
              if (
                (scheduledSeekTarget !== undefined || elapsed > LOAD_COMPENSATION_THRESHOLD_S) &&
                Math.abs((howl.seek(undefined, playedSoundId) as number) - correctedTime) > 0.03
              ) {
                // Public Howler seek pauses and restarts a playing HTML5 sound.
                // That second mobile play() delay recreates the exact lag this
                // correction is meant to remove.
                setHowlPosition(howl, correctedTime, playedSoundId)
              }
              const latestVolume = usePlayerStore.getState().volume
              howl.volume(latestVolume)
              syncReadyRef.current = true
            })
          } else {
            const pausedTarget = desiredPlaybackRef.current.getSeekTime?.() ?? seekTo ?? 0
            if (desiredPlaybackRef.current.getSeekTime || pausedTarget > 0) howl.seek(pausedTarget)
            howl.volume(currentVolume)
            usePlayerStore.getState().setCurrentTime(pausedTarget)
            syncReadyRef.current = true
          }
        },
        onplay: () => {
          if (howlRef.current !== howl) return
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
        onloaderror: (_id, msg) => {
          // If a newer track has been loaded, this Howl is stale — ignore.
          if (howlRef.current !== howl) return
          if (playbackSoundFactory.allowLoadRetry && !retryRef.current) {
            retryRef.current = true
            console.warn('Howl load error, retrying:', msg)
            howl.load()
            return
          }
          retryRef.current = false
          console.error('Howl load error (after retry):', msg)
          toast.error(`「${trackTitleRef.current}」加载失败，已跳到下一首`)
          onTrackEnd()
        },
        onplayerror: function (soundId: number) {
          // Try to recover via Howler unlock; give up after timeout
          if (playErrorTimerRef.current) clearTimeout(playErrorTimerRef.current)
          playErrorTimerRef.current = setTimeout(() => {
            playErrorTimerRef.current = null
            console.warn('Howl unlock timeout, skipping track')
            toast.error('播放失败，已跳到下一首')
            onTrackEnd()
          }, PLAY_ERROR_TIMEOUT_MS)
          howl.once('unlock', () => {
            if (howlRef.current !== howl) return // Already switched or unmounted
            if (playErrorTimerRef.current) {
              clearTimeout(playErrorTimerRef.current)
              playErrorTimerRef.current = null
            }
            howl.play(soundId)
          })
        },
      })

      desiredPlayback.howl = howl
      desiredPlaybackRef.current = desiredPlayback
      howlRef.current = howl
      usePlayerStore.getState().setCurrentTrack(track)
    },
    [onTrackEnd, startTimeUpdate, stopTimeUpdate],
  )

  const setDesiredPlayback = useCallback((shouldPlay: boolean, getSeekTime?: () => number) => {
    if (!desiredPlaybackRef.current) return
    desiredPlaybackRef.current.autoPlay = shouldPlay
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
  const startPlayback = useCallback((getSeekTime: () => number) => {
    const desired = desiredPlaybackRef.current
    const howl = howlRef.current
    if (!desired || !howl || desired.howl !== howl) return

    desired.autoPlay = true
    desired.getSeekTime = getSeekTime
    if (howl.state() !== 'loaded') return

    const targetTime = getSeekTime()
    howl.seek(targetTime)
    const soundId = soundIdRef.current !== undefined ? howl.play(soundIdRef.current) : howl.play()
    soundIdRef.current = soundId
    howl.once('play', (playedSoundId) => {
      if (howlRef.current !== howl || desiredPlaybackRef.current !== desired || playedSoundId !== soundId) return
      const correctedTime = getSeekTime()
      if (Math.abs((howl.seek(undefined, playedSoundId) as number) - correctedTime) > 0.03) {
        setHowlPosition(howl, correctedTime, playedSoundId)
      }
    })
  }, [])

  const stopAndUnload = useCallback(() => {
    if (unmuteTimerRef.current) clearTimeout(unmuteTimerRef.current)
    unmuteTimerRef.current = null
    if (playErrorTimerRef.current) clearTimeout(playErrorTimerRef.current)
    playErrorTimerRef.current = null
    desiredPlaybackRef.current = null
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
  }, [stopTimeUpdate])

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
    setDesiredPlayback,
    setScheduledPlayback,
    startPlayback,
    stopAndUnload,
  }
}
