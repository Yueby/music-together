import { trackKey } from '@/lib/utils'
import { useRoomStore } from '@/stores/roomStore'
import type { Track } from '@music-together/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

const EMPTY_QUEUE: Track[] = []

/** How long a song counts as "added" without showing up in the queue (the server may have refused it). */
const PENDING_MS = 5_000

/**
 * Which songs are in the room's queue, for lists that add songs to it. A song just sent counts as added at once, so the
 * button reacts at the click; but that is only a guess until the queue says so. Once the song is in the queue it is the
 * queue that decides (so removing it makes the song addable again), and a song the server never queued stops counting
 * after a few seconds.
 */
export function useQueueMembership() {
  const queue = useRoomStore((state) => state.room?.queue ?? EMPTY_QUEUE)
  const queueKeys = useMemo(() => new Set(queue.map(trackKey)), [queue])
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // A song that reached the queue no longer needs the guess.
  useEffect(() => {
    setPending((current) => {
      const stillPending = [...current].filter((key) => !queueKeys.has(key))
      return stillPending.length === current.size ? current : new Set(stillPending)
    })
  }, [queueKeys])

  useEffect(() => {
    const active = timers.current
    return () => {
      for (const timer of active.values()) clearTimeout(timer)
      active.clear()
    }
  }, [])

  const isAdded = useCallback(
    (track: Track) => {
      const key = trackKey(track)
      return queueKeys.has(key) || pending.has(key)
    },
    [queueKeys, pending],
  )

  const markPending = useCallback((tracks: Track[]) => {
    const keys = tracks.map(trackKey)
    setPending((current) => new Set([...current, ...keys]))
    for (const key of keys) {
      clearTimeout(timers.current.get(key))
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key)
          setPending((current) => {
            if (!current.has(key)) return current
            const next = new Set(current)
            next.delete(key)
            return next
          })
        }, PENDING_MS),
      )
    }
  }, [])

  /** Send a song to the queue unless it is already there (then say so). */
  const addOnce = useCallback(
    (track: Track, send: (track: Track) => void) => {
      if (isAdded(track)) {
        toast.info(`「${track.title}」已在队列中`)
        return
      }
      send(track)
      markPending([track])
    },
    [isAdded, markPending],
  )

  return { queue, isAdded, markPending, addOnce }
}
