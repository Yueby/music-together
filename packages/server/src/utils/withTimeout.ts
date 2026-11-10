/** Reject with `onTimeout` if `work` has not settled in `ms`. The timer is always cleared. */
export function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}
