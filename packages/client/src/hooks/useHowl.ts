import { useCallback, useEffect, useRef } from 'react'
import { Howl } from 'howler'
import type { Track } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import {
  CURRENT_TIME_THROTTLE_MS,
  HOWL_UNMUTE_DELAY_SEEK_MS,
  HOWL_UNMUTE_DELAY_DEFAULT_MS,
  LOAD_COMPENSATION_THRESHOLD_S,
} from '@/lib/constants'
import { toast } from 'sonner'

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
  const howlRef = useRef<Howl | null>(null)
  const soundIdRef = useRef<number | undefined>(undefined)
  const animFrameRef = useRef<number>(0)
  const syncReadyRef = useRef(false)
  const unmuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTimeUpdateRef = useRef(0)
  const stalledRef = useRef<{ lastSeek: number; since: number }>({ lastSeek: -1, since: 0 })
  const trackTitleRef = useRef<string>('')
  const retryRef = useRef(false)

  // Use selectors for the one reactive value we need (volume sync effect)
  const volume = usePlayerStore((s) => s.volume)

  // Throttled time update loop with stalled detection
  const startTimeUpdate = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    stalledRef.current = { lastSeek: -1, since: 0 }
    const update = () => {
      if (howlRef.current && howlRef.current.playing()) {
        const now = performance.now()
        if (now - lastTimeUpdateRef.current >= CURRENT_TIME_THROTTLE_MS) {
          lastTimeUpdateRef.current = now
          const seekVal = howlRef.current.seek() as number
          usePlayerStore.getState().setCurrentTime(seekVal)

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
        try { howlRef.current.unload() } catch { /* ignore */ }
        howlRef.current = null
        stopTimeUpdate()
      }

      syncReadyRef.current = false
      soundIdRef.current = undefined
      trackTitleRef.current = track.title
      retryRef.current = false

      if (!track.streamUrl) return

      const loadStartTime = Date.now()
      const currentVolume = usePlayerStore.getState().volume

      const howl = new Howl({
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
          if (autoPlay) {
            if (seekTo && seekTo > 0) {
              // Update store immediately so AMLL lyrics jump to correct position
              usePlayerStore.getState().setCurrentTime(seekTo)
            }
            soundIdRef.current = howl.play()
            howl.once('play', () => {
              if (howlRef.current !== howl) return
              const elapsed = (Date.now() - loadStartTime) / 1000
              const seekTarget = (seekTo ?? 0) + elapsed
              // seekTo > 0: must seek to correct position (+ loading compensation)
              // seekTo === 0: only compensate if loading took significant time
              if ((seekTo && seekTo > 0) || elapsed > LOAD_COMPENSATION_THRESHOLD_S) {
                howl.seek(seekTarget)
              }
            })
            unmuteTimerRef.current = setTimeout(() => {
              if (howlRef.current === howl) {
                const latestVolume = usePlayerStore.getState().volume
                howl.fade(0, latestVolume, 200) // Smooth fade-in with latest volume
                syncReadyRef.current = true
              }
            }, seekTo && seekTo > 0 ? HOWL_UNMUTE_DELAY_SEEK_MS : HOWL_UNMUTE_DELAY_DEFAULT_MS)
          } else {
            if (seekTo && seekTo > 0) howl.seek(seekTo)
            howl.volume(currentVolume)
            usePlayerStore.getState().setCurrentTime(seekTo ?? 0)
            syncReadyRef.current = true
          }
        },
        onplay: () => {
          usePlayerStore.getState().setIsPlaying(true)
          const dur = howl.duration()
          if (Number.isFinite(dur) && dur > 0) {
            usePlayerStore.getState().setDuration(dur)
          }
          startTimeUpdate()
        },
        onpause: () => {
          usePlayerStore.getState().setIsPlaying(false)
          stopTimeUpdate()
        },
        onend: () => {
          usePlayerStore.getState().setIsPlaying(false)
          stopTimeUpdate()
          onTrackEnd()
        },
        onloaderror: (_id, msg) => {
          // If a newer track has been loaded, this Howl is stale — ignore.
          if (howlRef.current !== howl) return
          if (!retryRef.current) {
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

      howlRef.current = howl
      usePlayerStore.getState().setCurrentTrack(track)
    },
    [onTrackEnd, startTimeUpdate, stopTimeUpdate],
  )

  // Volume sync
  useEffect(() => {
    if (howlRef.current && syncReadyRef.current) {
      howlRef.current.volume(volume)
    }
  }, [volume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unmuteTimerRef.current) {
        clearTimeout(unmuteTimerRef.current)
        unmuteTimerRef.current = null
      }
      if (playErrorTimerRef.current) {
        clearTimeout(playErrorTimerRef.current)
        playErrorTimerRef.current = null
      }
      if (howlRef.current) {
        try { howlRef.current.unload() } catch { /* ignore */ }
        howlRef.current = null
      }
      stopTimeUpdate()
    }
  }, [stopTimeUpdate])

  return { howlRef, soundIdRef, loadTrack }
}
