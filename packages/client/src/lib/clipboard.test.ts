// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { canCopyText, copyText, getRoomShareUrl } from './clipboard'

const runtime = vi.hoisted(() => ({ clipboard: true }))
vi.mock('./hostRuntime', () => ({ hostRuntime: runtime }))

afterEach(() => {
  runtime.clipboard = true
  vi.unstubAllGlobals()
})

describe('Web clipboard', () => {
  it('writes text using the browser clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(canCopyText()).toBe(true)
    await expect(copyText('sample')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledExactlyOnceWith('sample')
  })

  it('does not access the clipboard when the runtime disables it', async () => {
    const clipboard = vi.fn()
    vi.stubGlobal('navigator', Object.defineProperty({}, 'clipboard', { get: clipboard }))
    runtime.clipboard = false
    expect(canCopyText()).toBe(false)
    await expect(copyText('sample')).resolves.toBe(false)
    expect(clipboard).not.toHaveBeenCalled()
  })

  it.each([undefined, {}, { writeText: vi.fn().mockRejectedValue(new Error('denied')) }])(
    'reports failure when the browser cannot write to the clipboard',
    async (clipboard) => {
      vi.stubGlobal('navigator', { clipboard })
      await expect(copyText('sample')).resolves.toBe(false)
    },
  )

  it('uses the current Web origin for room share URLs', () => {
    expect(getRoomShareUrl('room-1')).toBe(`${window.location.origin}/room/room-1`)
  })
})
