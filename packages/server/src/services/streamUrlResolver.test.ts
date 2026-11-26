import { describe, expect, it, vi } from 'vitest'
import { resolveStreamUrl } from './streamUrlResolver.js'

describe('stream URL resolution', () => {
  it('does not start a lookup when the playback request is stale', async () => {
    const getStreamUrl = vi.fn().mockResolvedValue(null)
    await expect(resolveStreamUrl({ getStreamUrl }, 'tencent', 'song', 320, undefined, () => false))
      .resolves.toBeNull()
    expect(getStreamUrl).not.toHaveBeenCalled()
  })

  it('stops downgrading when an in-flight lookup is superseded', async () => {
    let valid = true
    const getStreamUrl = vi.fn()
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => {
        valid = false
        return null
      })

    await expect(resolveStreamUrl({ getStreamUrl }, 'tencent', 'song', 999, undefined, () => valid))
      .resolves.toBeNull()
    expect(getStreamUrl.mock.calls.map(([, , quality]) => quality)).toEqual([999, 320])
  })
})
