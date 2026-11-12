/**
 * When a rejoin ticket stops being usable, on the clock of the machine that received it.
 *
 * The server stamps an absolute `expiresAt` on its own clock. A phone or PC whose clock runs ahead of the server's by
 * more than the ticket's lifetime would see every fresh ticket as already expired and throw it away, so the lifetime
 * (`ttlMs`, sent along since it became part of the event) is counted from the moment the ticket arrived instead.
 * Without `ttlMs` (an older server) the server's `expiresAt` is all there is.
 */
export function rejoinTicketExpiry(ticket: { expiresAt: number; ttlMs?: number }, receivedAt: number): number {
  const { ttlMs } = ticket
  return typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0 ? receivedAt + ttlMs : ticket.expiresAt
}
