import { useEffect, useRef, type MutableRefObject } from 'react'
import type { Howl } from 'howler'
import { EVENTS } from '@music-together/shared'
import type { PlayState } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { useSocketContext } from '@/providers/SocketProvider'

/** Manages playback sync: host reporting + client drift correction */
export function usePlayerSync(
  howlRef: MutableRefObject<Howl | null>,
  syncReadyRef: MutableRefObject<boolean>,
) {
  const { socket } = useSocketContext()
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime)
  const syncDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Listen for PLAYER_SEEK, PLAYER_SYNC_RESPONSE, PLAYER_PAUSE
  useEffect(() => {
    const clearSyncDelay = () => {
      if (syncDelayTimerRef.current) {
        clearTimeout(syncDelayTimerRef.current)
        syncDelayTimerRef.current = null
      }
    }

    const scheduleSyncReady = () => {
      clearSyncDelay()
      syncReadyRef.current = false
      syncDelayTimerRef.current = setTimeout(() => {
        syncReadyRef.current = true
        syncDelayTimerRef.current = null
      }, 1500)
    }

    const onSeek = (data: { playState: PlayState }) => {
      if (howlRef.current) {
        howlRef.current.seek(data.playState.currentTime)
        scheduleSyncReady()
      }
      setCurrentTime(data.playState.currentTime)
    }

    const onSyncResponse = (data: { currentTime: number; isPlaying: boolean; serverTimestamp: number }) => {
      if (!howlRef.current || !syncReadyRef.current) return
      if (!howlRef.current.playing()) return

      const currentSeek = howlRef.current.seek() as number
      const drift = Math.abs(currentSeek - data.currentTime)
      if (drift > 3) {
        howlRef.current.seek(data.currentTime)
        scheduleSyncReady()
      }
    }

    const onPause = () => {
      howlRef.current?.pause()
    }

    socket.on(EVENTS.PLAYER_SEEK, onSeek)
    socket.on(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)
    socket.on(EVENTS.PLAYER_PAUSE, onPause)

    return () => {
      clearSyncDelay()
      socket.off(EVENTS.PLAYER_SEEK, onSeek)
      socket.off(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)
      socket.off(EVENTS.PLAYER_PAUSE, onPause)
    }
  }, [socket, howlRef, syncReadyRef, setCurrentTime])

  // Periodic sync request (client-initiated)
  useEffect(() => {
    const interval = setInterval(() => {
      socket.emit(EVENTS.PLAYER_SYNC_REQUEST)
    }, 12000)
    return () => clearInterval(interval)
  }, [socket])

  // Host progress reporting (hybrid sync)
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
  }, [socket, howlRef])
}
