/**
 * Bookkeeping for the automatic re-send of persisted platform cookies after a room join.
 *
 * `useRoomState` announces how many AUTH_SET_COOKIE requests it just emitted;
 * `useAuthSync` consumes one per result so that the silent restore does not toast
 * for every platform, while a manual login afterwards still does.
 */
let pending = 0

export const authAutoResend = {
  /** Replace the outstanding count with the number of requests just sent. */
  begin(count: number): void {
    pending = count
  },
  /** Returns true if the result belongs to an automatic re-send (and consumes it). */
  consume(): boolean {
    if (pending <= 0) return false
    pending--
    return true
  },
  reset(): void {
    pending = 0
  },
}
