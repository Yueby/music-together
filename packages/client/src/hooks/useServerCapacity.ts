import { useCallback, useEffect } from 'react'
import {
  EVENTS,
  type AdmissionCancelledEvent,
  type AdmissionQueuedEvent,
  type ServerCapacityStatus,
} from '@music-together/shared'
import { toast } from 'sonner'
import { useSocketContext } from '@/providers/SocketProvider'
import { useServerStatusStore } from '@/stores/serverStatusStore'

/**
 * Invisible subscriber mounted once inside AppSurface so both Web and Mini-App routes stay synced
 * with server capacity updates and admission queue events.
 */
export function ServerCapacitySync() {
  const { socket } = useSocketContext()

  useEffect(() => {
    const requestCapacity = () => {
      if (socket.connected) socket.emit(EVENTS.SERVER_CAPACITY_GET)
    }

    const onCapacityUpdate = (status: ServerCapacityStatus) => {
      useServerStatusStore.getState().setCapacity(status)
    }

    const onAdmissionQueued = (data: AdmissionQueuedEvent) => {
      useServerStatusStore.getState().setAdmissionQueue(data)
    }

    const onAdmissionCancelled = (data: AdmissionCancelledEvent) => {
      const wasQueued = useServerStatusStore.getState().admissionQueue !== null
      useServerStatusStore.getState().clearAdmissionQueue()
      if (!wasQueued) return
      if (data.reason === 'user') return
      if (data.reason === 'replaced') {
        if (data.message) toast.info(data.message)
        return
      }
      if (data.message) toast.error(data.message)
    }

    const onRoomState = () => {
      if (useServerStatusStore.getState().admissionQueue !== null) {
        useServerStatusStore.getState().clearAdmissionQueue()
      }
    }

    const onDisconnect = () => {
      // Server preserves the queue spot across brief disconnects and re-emits ADMISSION_QUEUED on reconnect.
      if (useServerStatusStore.getState().admissionQueue !== null) {
        useServerStatusStore.getState().clearAdmissionQueue()
      }
    }

    requestCapacity()
    socket.on('connect', requestCapacity)
    socket.on('disconnect', onDisconnect)
    socket.on(EVENTS.SERVER_CAPACITY_UPDATE, onCapacityUpdate)
    socket.on(EVENTS.ADMISSION_QUEUED, onAdmissionQueued)
    socket.on(EVENTS.ADMISSION_CANCELLED, onAdmissionCancelled)
    socket.on(EVENTS.ROOM_STATE, onRoomState)

    return () => {
      socket.off('connect', requestCapacity)
      socket.off('disconnect', onDisconnect)
      socket.off(EVENTS.SERVER_CAPACITY_UPDATE, onCapacityUpdate)
      socket.off(EVENTS.ADMISSION_QUEUED, onAdmissionQueued)
      socket.off(EVENTS.ADMISSION_CANCELLED, onAdmissionCancelled)
      socket.off(EVENTS.ROOM_STATE, onRoomState)
    }
  }, [socket])

  return null
}

/** Read server load status & manage the user's admission queue spot. */
export function useServerCapacity() {
  const { socket } = useSocketContext()
  const capacity = useServerStatusStore((s) => s.capacity)
  const admissionQueue = useServerStatusStore((s) => s.admissionQueue)

  const cancelQueue = useCallback(() => {
    useServerStatusStore.getState().clearAdmissionQueue()
    if (socket.connected) {
      socket.emit(EVENTS.ADMISSION_CANCEL)
    }
  }, [socket])

  return { capacity, admissionQueue, cancelQueue }
}
