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

  // Guard: don't process SYNC_RESPONSE until the current track is fully loaded
  const isLoadedRef = useRef(false)

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

  // --------------- Load track (core fix) ---------------
  // Accepts optional `seekTo` so the correct sequence is: create → onload → seek → play.
  // This avoids the old bug where play() and seek() were called before the audio was ready.

  const loadTrack = useCallback(
    (track: Track, seekTo?: number) => {
      // Thoroughly clean up previous Howl instance
      if (howlRef.current) {
        try { howlRef.current.unload() } catch { /* ignore */ }
        howlRef.current = null
        stopTimeUpdate()
      }

      isLoadedRef.current = false

      if (!track.streamUrl) return

      const howl = new Howl({
        src: [track.streamUrl],
        html5: true,
        format: ['mp3'],
        volume,
        onload: () => {
          // Mark as loaded — SYNC_RESPONSE handling is now allowed
          isLoadedRef.current = true
          setDuration(howl.duration())

          // Seek FIRST, then play — correct order prevents audio flash from position 0
          if (seekTo && seekTo > 0) {
            howl.seek(seekTo)
          }
          howl.play()
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
          isLoadedRef.current = false
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
    [volume, socket, setCurrentTrack, setIsPlaying, setDuration, startTimeUpdate, stopTimeUpdate],
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
    // --- PLAYER_PLAY: load track with correct seek position ---
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

        // Single call handles everything: create Howl → onload → seek → play
        loadTrack(data.track, data.playState.currentTime)
        fetchLyric(data.track)
      },
    )

    // --- PLAYER_PAUSE ---
    socket.on(EVENTS.PLAYER_PAUSE, () => {
      howlRef.current?.pause()
    })

    // --- PLAYER_SEEK ---
    socket.on(EVENTS.PLAYER_SEEK, (data: { currentTime: number }) => {
      if (howlRef.current && isLoadedRef.current) {
        howlRef.current.seek(data.currentTime)
      }
      setCurrentTime(data.currentTime)
    })

    // --- PLAYER_SYNC_RESPONSE: only correct large drift, never control play/pause ---
    socket.on(
      EVENTS.PLAYER_SYNC_RESPONSE,
      (data: { currentTime: number; isPlaying: boolean; serverTimestamp: number }) => {
        // Don't process sync while loading — prevents the seek-to-0 → seek-to-N bounce
        if (!howlRef.current || !isLoadedRef.current) return

        const currentSeek = howlRef.current.seek() as number
        const drift = Math.abs(currentSeek - data.currentTime)

        // Only correct drift > 3 seconds to avoid choppy audio
        if (drift > 3) {
          howlRef.current.seek(data.currentTime)
        }
        // Do NOT control play/pause here — that's the job of PLAYER_PLAY/PLAYER_PAUSE events
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
  // The host reports its real Howler seek() position every 5 seconds.
  // The server uses this to calibrate estimateCurrentTime() for all other clients.

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

  useEffect(() => {
    if (howlRef.current) {
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
