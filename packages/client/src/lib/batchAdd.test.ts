import { LIMITS } from '@music-together/shared'
import type { Track } from '@music-together/shared'
import { describe, expect, it } from 'vitest'
import { batchAddMessage, planBatchAdd } from './batchAdd'

const tracks = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, sourceId: `${i}` }) as unknown as Track)

describe('planBatchAdd', () => {
  it('skips tracks that are already queued', () => {
    const list = tracks(4)
    const plan = planBatchAdd(list, (track) => track.id === 't1', 0)
    expect(plan.toAdd.map((track) => track.id)).toEqual(['t0', 't2', 't3'])
    expect(batchAddMessage(plan)).toBe('已添加全部 3 首到队列')
  })

  it('stops at the queue limit and says how many were left out', () => {
    const plan = planBatchAdd(tracks(10), () => false, LIMITS.QUEUE_MAX_SIZE - 4)
    expect(plan.count).toBe(4)
    expect(plan.toAdd).toHaveLength(4)
    expect(plan.queueFull).toBe(false)
    expect(batchAddMessage(plan)).toBe('已添加 4 首到队列（队列已满，还有 6 首未添加）')
  })

  it('adds nothing to a full (or overfull) queue', () => {
    for (const length of [LIMITS.QUEUE_MAX_SIZE, LIMITS.QUEUE_MAX_SIZE + 5]) {
      const plan = planBatchAdd(tracks(3), () => false, length)
      expect(plan).toMatchObject({ count: 0, toAdd: [], queueFull: true })
    }
  })
})
