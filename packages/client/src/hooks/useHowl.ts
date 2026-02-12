import { useCallback, useEffect, useRef } from 'react'
import { Howl } from 'howler'
import type { Track } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'

/**
 * Manages a Howl audio instance with two-phase loading strategy:
 * Phase 1: Create Howl with volume=0 (silent)
 * Phase 2: onload → seek to target → delay → unmute
 */
export function useHowl(onTrackEnd: () => void) {
  const howlRef = useRef<Howl | null>(null)
  const animFrameRef = useRef<number>(0)
  const syncReadyRef = useRef(false)
  const unmuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    setCurrentTrack,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    volume,
  } = usePlayerStore()

  // Time update loop
  const startTimeUpdate = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    const update = () => {
      if (howlRef.current && howlRef.current.playing()) {
        setCurrentTime(howlRef.current.seek() as number)
      }
      animFrameRef.current = requestAnimationFrame(update)
    }
    animFrameRef.current = requestAnimationFrame(update)
  }, [setCurrentTime])

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

      if (howlRef.current) {
        try { howlRef.current.unload() } catch { /* ignore */ }
        howlRef.current = null
        stopTimeUpdate()
      }

      syncReadyRef.current = false

      if (!track.streamUrl) return

      const loadStartTime = Date.now()

      const howl = new Howl({
        src: [track.streamUrl],
        html5: true,
        format: ['mp3'],
        volume: 0,
        onload: () => {
          setDuration(howl.duration())
          if (autoPlay) {
            if (seekTo && seekTo > 0) {
              // Update store immediately so AMLL lyrics jump to correct position
              // before startTimeUpdate() kicks in via onplay.
              setCurrentTime(seekTo)
              // Play first (still muted at volume 0), then seek once audio is ready.
              // HTML5 streaming audio may ignore seek() before play(), so we defer it.
              howl.play()
              howl.once('play', () => {
                if (howlRef.current !== howl) return
                const elapsed = (Date.now() - loadStartTime) / 1000
                howl.seek(seekTo + elapsed)
              })
            } else {
              howl.play()
            }
            unmuteTimerRef.current = setTimeout(() => {
              if (howlRef.current === howl) {
                howl.volume(volume)
                syncReadyRef.current = true
              }
            }, seekTo && seekTo > 0 ? 1200 : 100)
          } else {
            if (seekTo && seekTo > 0) howl.seek(seekTo)
            howl.volume(volume)
            setCurrentTime(seekTo ?? 0)
            syncReadyRef.current = true
          }
        },
        onplay: () => {
          setIsPlaying(true)
          setDuration(howl.duration())
          startTimeUpdate()
        },
        onpause: () => {
          setIsPlaying(false)
          stopTimeUpdate()
        },
        onend: () => {
          setIsPlaying(false)
          stopTimeUpdate()
          onTrackEnd()
        },
        onloaderror: (_id, msg) => console.error('Howl load error:', msg),
        onplayerror: function () {
          howl.once('unlock', () => howl.play())
        },
      })

      howlRef.current = howl
      setCurrentTrack(track)
    },
    [volume, onTrackEnd, setCurrentTrack, setIsPlaying, setCurrentTime, setDuration, startTimeUpdate, stopTimeUpdate],
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
      if (howlRef.current) {
        try { howlRef.current.unload() } catch { /* ignore */ }
        howlRef.current = null
      }
      stopTimeUpdate()
    }
  }, [stopTimeUpdate])

  return { howlRef, syncReadyRef, loadTrack }
}
