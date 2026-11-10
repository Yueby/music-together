import './cspValidation.ts'
import { config } from 'zod/v4'
import { mappRoomMediaQuerySchema } from '@music-together/shared'
import { describe, expect, it, vi } from 'vitest'

describe('micro-app CSP validation', () => {
  it('validates shared schemas without attempting dynamic code generation', () => {
    expect(config().jitless).toBe(true)
    const compile = vi.spyOn(globalThis, 'Function').mockImplementation(() => {
      throw new EvalError('CSP_BLOCKED')
    })
    try {
      expect(mappRoomMediaQuerySchema.safeParse({ roomId: 'ABC123', trackId: 'track-1' }).success).toBe(true)
      expect(mappRoomMediaQuerySchema.safeParse({ roomId: 'bad', trackId: 'track-1' }).success).toBe(false)
      expect(compile).not.toHaveBeenCalled()
    } finally {
      compile.mockRestore()
    }
  })
})
