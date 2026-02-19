import { Router, type Router as RouterType } from 'express'
import { roomRepo } from '../repositories/roomRepository.js'

const router: RouterType = Router()

/** Validate roomId: alphanumeric + _ -, 1-20 chars (matches nanoid urlAlphabet) */
function isValidRoomId(roomId: string): boolean {
  return typeof roomId === 'string' && roomId.length >= 1 && roomId.length <= 20 && /^[A-Za-z0-9_-]+$/.test(roomId)
}

/**
 * GET /api/rooms/:roomId/check
 * Pre-check whether a room exists and whether it requires a password.
 * Used by the client before showing the InteractionGate so that:
 *   - Non-existent rooms redirect immediately (no pointless gate click)
 *   - Password-protected rooms show a password field inside the gate
 */
router.get('/:roomId/check', (req, res) => {
  const { roomId } = req.params
  if (!isValidRoomId(roomId)) {
    res.status(400).json({ error: 'Invalid room ID' })
    return
  }
  const room = roomRepo.get(roomId)

  if (!room) {
    res.status(404).json({ exists: false })
    return
  }

  res.json({
    exists: true,
    hasPassword: room.password !== null,
    name: room.name,
    userCount: room.users.length,
  })
})

export default router
