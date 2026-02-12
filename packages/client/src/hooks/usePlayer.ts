import { useEffect, useCallback, useRef } from 'react'
import { Howl } from 'howler'
import type { Socket } from 'socket.io-client'
import { EVENTS, type Track, type PlayState } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'

export function usePlayer(socket: Socket) {
  const howlRef = useRef<Howl | null>(null)
  const animFrameRef = useRef<number>(0)

  // Guard: prevent duplicate PLAYER_PLAY processing (eliminates ghost audio)
  const loadingRef = useRef<{ trackId: string; ts: number } | null>(null)

  // State-based sync guard: SYNC_RESPONSE is only processed when true.
  // Set to true after the two-phase load has fully settled (seek done + unmute).
  const syncReadyRef = useRef(false)

  // Timer for the delayed unmute after seek settles
  const unmuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    setCurrentTrack,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    volume,
    setQueue,
    setLyric,
  } = usePlayerStore()

  // --------------- Time update loop ---------------

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

  // --------------- Load track (two-phase strategy) ---------------
  //
  // Phase 1: Create Howl with volume=0 (silent). onload → play() (no seeking).
  // Phase 2: onplay → seek to target + elapsed → 500ms delay → fade in volume.
  //
  // This avoids the HTML5 streaming audio bug where seek() during onload is
  // unreliable because the target position hasn't been buffered yet.
  // By waiting until onplay, the audio element is in a stable playable state.
  //
  // `autoPlay` controls whether to actually play (false = paused room join).

  const loadTrack = useCallback(
    (track: Track, seekTo?: number, autoPlay = true) => {
      // Cancel any pending unmute from a previous load
      if (unmuteTimerRef.current) {
        clearTimeout(unmuteTimerRef.current)
        unmuteTimerRef.current = null
      }

      // Thoroughly clean up previous Howl instance
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
        volume: 0, // Always start silent to avoid hearing wrong position / seek noise
        onload: () => {
          setDuration(howl.duration())

          if (autoPlay) {
            // Seek FIRST (before play) — more reliable for HTML5 streaming
            if (seekTo && seekTo > 0) {
              const elapsed = (Date.now() - loadStartTime) / 1000
              howl.seek(seekTo + elapsed)
            }
            howl.play()

            // Wait for seek to buffer and audio to stabilize, then unmute.
            // Direct volume set (no fade) to avoid amplifying seek buffer noise.
            unmuteTimerRef.current = setTimeout(() => {
              if (howlRef.current === howl) {
                howl.volume(volume)
                syncReadyRef.current = true
              }
            }, seekTo && seekTo > 0 ? 1200 : 100)
          } else {
            // Paused room: seek to position without playing
            if (seekTo && seekTo > 0) {
              howl.seek(seekTo)
            }
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
          socket.emit(EVENTS.PLAYER_NEXT)
        },
        onloaderror: (_id, msg) => {
          console.error('Howl load error:', msg)
        },
        onplayerror: function () {
          howl.once('unlock', () => {
            howl.play()
          })
        },
      })

      howlRef.current = howl
      setCurrentTrack(track)
    },
    [volume, socket, setCurrentTrack, setIsPlaying, setCurrentTime, setDuration, startTimeUpdate, stopTimeUpdate],
  )

  // --------------- Fetch lyrics ---------------

  const fetchLyric = useCallback(
    async (track: Track) => {
      if (!track.lyricId) {
        setLyric('', '')
        return
      }
      try {
        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
        const res = await fetch(
          `${serverUrl}/api/music/lyric?source=${track.source}&lyricId=${encodeURIComponent(track.lyricId)}`,
        )
        if (!res.ok) throw new Error('Lyric fetch failed')
        const data = await res.json()
        setLyric(data.lyric || '', data.tlyric || '')
      } catch {
        setLyric('', '')
      }
    },
    [setLyric],
  )

  // --------------- Socket event listeners ---------------

  useEffect(() => {
    // --- PLAYER_PLAY: two-phase load with seek ---
    socket.on(
      EVENTS.PLAYER_PLAY,
      (data: { track: Track; playState: PlayState }) => {
        // Deduplicate: ignore if the same track was requested within 2 seconds
        const now = Date.now()
        if (
          loadingRef.current?.trackId === data.track.id &&
          now - loadingRef.current.ts < 2000
        ) {
          return
        }
        loadingRef.current = { trackId: data.track.id, ts: now }

        // Pass isPlaying to control auto-play (handles paused room join)
        loadTrack(data.track, data.playState.currentTime, data.playState.isPlaying)
        fetchLyric(data.track)
      },
    )

    // --- PLAYER_PAUSE ---
    socket.on(EVENTS.PLAYER_PAUSE, () => {
      howlRef.current?.pause()
    })

    // --- PLAYER_SEEK (explicit user action, always apply) ---
    socket.on(EVENTS.PLAYER_SEEK, (data: { currentTime: number }) => {
      if (howlRef.current) {
        howlRef.current.seek(data.currentTime)
        // Briefly block sync to let seek settle
        syncReadyRef.current = false
        setTimeout(() => { syncReadyRef.current = true }, 1500)
      }
      setCurrentTime(data.currentTime)
    })

    // --- PLAYER_SYNC_RESPONSE: only correct large drift when sync is ready ---
    socket.on(
      EVENTS.PLAYER_SYNC_RESPONSE,
      (data: { currentTime: number; isPlaying: boolean; serverTimestamp: number }) => {
        if (!howlRef.current || !syncReadyRef.current) return

        // Only correct if actually playing
        if (!howlRef.current.playing()) return

        const currentSeek = howlRef.current.seek() as number
        const drift = Math.abs(currentSeek - data.currentTime)

        // Only correct drift > 3 seconds
        if (drift > 3) {
          howlRef.current.seek(data.currentTime)
          // Briefly block sync after correction to let seek settle
          syncReadyRef.current = false
          setTimeout(() => { syncReadyRef.current = true }, 1500)
        }
      },
    )

    // --- QUEUE_UPDATED ---
    socket.on(EVENTS.QUEUE_UPDATED, (data: { queue: Track[] }) => {
      setQueue(data.queue)
    })

    return () => {
      socket.off(EVENTS.PLAYER_PLAY)
      socket.off(EVENTS.PLAYER_PAUSE)
      socket.off(EVENTS.PLAYER_SEEK)
      socket.off(EVENTS.PLAYER_SYNC_RESPONSE)
      socket.off(EVENTS.QUEUE_UPDATED)
    }
  }, [socket, loadTrack, setCurrentTime, setQueue, fetchLyric])

  // --------------- Periodic sync calibration (client-initiated) ---------------

  useEffect(() => {
    const interval = setInterval(() => {
      socket.emit(EVENTS.PLAYER_SYNC_REQUEST)
    }, 12000)

    return () => clearInterval(interval)
  }, [socket])

  // --------------- Host progress reporting (hybrid sync) ---------------

  useEffect(() => {
    const interval = setInterval(() => {
      const currentUser = useRoomStore.getState().currentUser
      if (!currentUser?.isHost) return
      if (howlRef.current?.playing()) {
        socket.emit(EVENTS.PLAYER_SYNC, {
          currentTime: howlRef.current.seek() as number,
        })
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [socket])

  // --------------- Volume sync ---------------
  // Only apply volume changes when sync is ready (i.e., not during silent loading phase).

  useEffect(() => {
    if (howlRef.current && syncReadyRef.current) {
      howlRef.current.volume(volume)
    }
  }, [volume])

  // --------------- Cleanup on unmount ---------------

  useEffect(() => {
    return () => {
      if (howlRef.current) {
        try { howlRef.current.unload() } catch { /* ignore */ }
        howlRef.current = null
      }
      stopTimeUpdate()
    }
  }, [stopTimeUpdate])

  // --------------- Exposed controls ---------------

  const play = useCallback(() => {
    socket.emit(EVENTS.PLAYER_PLAY)
  }, [socket])

  const pause = useCallback(() => {
    socket.emit(EVENTS.PLAYER_PAUSE)
  }, [socket])

  const seek = useCallback(
    (time: number) => {
      socket.emit(EVENTS.PLAYER_SEEK, { currentTime: time })
    },
    [socket],
  )

  const next = useCallback(() => {
    socket.emit(EVENTS.PLAYER_NEXT)
  }, [socket])

  return { play, pause, seek, next, howlRef }
}
