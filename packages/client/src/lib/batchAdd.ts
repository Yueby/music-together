import { LIMITS } from '@music-together/shared'
import type { Track } from '@music-together/shared'

export interface BatchAddPlan {
  /** Tracks not in the queue yet. */
  unique: Track[]
  /** How many of them still fit under the queue limit. */
  count: number
  /** The tracks to add now. */
  toAdd: Track[]
  /** The queue has no room left at all. */
  queueFull: boolean
}

/** What "add all" does for a list: skip what is already queued and stop at the queue limit. */
export function planBatchAdd(tracks: Track[], isAdded: (track: Track) => boolean, queueLength: number): BatchAddPlan {
  const availableSlots = LIMITS.QUEUE_MAX_SIZE - queueLength
  const unique = tracks.filter((track) => !isAdded(track))
  const count = Math.max(0, Math.min(availableSlots, unique.length))
  return { unique, count, toAdd: unique.slice(0, count), queueFull: availableSlots <= 0 }
}

/** The confirmation shown after adding `plan.toAdd`. */
export function batchAddMessage(plan: BatchAddPlan): string {
  return plan.count < plan.unique.length
    ? `已添加 ${plan.count} 首到队列（队列已满，还有 ${plan.unique.length - plan.count} 首未添加）`
    : `已添加全部 ${plan.count} 首到队列`
}
