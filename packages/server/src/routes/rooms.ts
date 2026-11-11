import { ROOM_ID_PATTERN } from '@music-together/shared'
import { Router, type Router as RouterType } from 'express'
import { roomRepo } from '../repositories/roomRepository.js'

const router: RouterType = Router()

function isValidRoomId(roomId: string): boolean {
  return typeof roomId === 'string' && ROOM_ID_PATTERN.test(roomId)
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
