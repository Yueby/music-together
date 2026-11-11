import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withTimeout, withTimeoutOrNull } from './withTimeout.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('withTimeout', () => {
  it('passes the result through, and rejects with the given error when time runs out', async () => {
    await expect(withTimeout(Promise.resolve(1), 100, new Error('late'))).resolves.toBe(1)
    const never = new Promise<number>(() => {})
    const pending = withTimeout(never, 100, new Error('late')).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(100)
    expect(await pending).toMatchObject({ message: 'late' })
  })
})

describe('withTimeoutOrNull', () => {
  it('passes the result of a promise through', async () => {
    await expect(withTimeoutOrNull(Promise.resolve('ok'), 100)).resolves.toBe('ok')
  })

  it('answers null, not an error, when a promise takes too long', async () => {
    const pending = withTimeoutOrNull(new Promise<string>(() => {}), 100)
    await vi.advanceTimersByTimeAsync(100)
    await expect(pending).resolves.toBeNull()
  })

  it('hands a function an abort signal, and answers null when that deadline passes', async () => {
    let received: AbortSignal | undefined
    const pending = withTimeoutOrNull((signal) => {
      received = signal
      return new Promise<string>((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
      )
    }, 100)
    await vi.advanceTimersByTimeAsync(100)
    await expect(pending).resolves.toBeNull()
    expect(received?.aborted).toBe(true)
  })

  it('does not hide a real failure of a function', async () => {
    await expect(withTimeoutOrNull(() => Promise.reject(new Error('boom')), 100)).rejects.toThrow('boom')
  })
})
