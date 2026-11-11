/**
 * Time limits for work that can hang. There are two on purpose — they fail differently, and mixing them up turns a
 * timeout into a silent `null` or a thrown error:
 *
 * - `withTimeout` rejects with the error you give it: the caller treats a timeout as a failure.
 * - `withTimeoutOrNull` resolves `null`: the caller treats "no answer in time" like "no result" (catalog lookups
 *   that degrade to an empty list).
 */

/** Reject with `onTimeout` if `work` has not settled in `ms`. The timer is always cleared. */
export function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Resolve `null` if `work` has not settled in `ms`. `work` is a promise (a legacy SDK call that cannot be cancelled: it
 * just stops being waited for) or a function of an abort signal (a `fetch`, which really is cancelled at the deadline).
 */
export async function withTimeoutOrNull<T>(
  work: Promise<T> | ((signal: AbortSignal) => Promise<T>),
  ms: number,
): Promise<T | null> {
  if (typeof work === 'function') {
    try {
      return await work(AbortSignal.timeout(ms))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') return null
      throw error
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
