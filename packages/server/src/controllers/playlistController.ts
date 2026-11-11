import { EVENTS, platformEventSchema } from '@music-together/shared'
import type { MusicSource } from '@music-together/shared'
import * as authService from '../services/authService.js'
import { listUserPlaylists } from '../services/authProvider.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { checkAuthRateLimit } from '../middleware/socketRateLimiter.js'

export function registerPlaylistController(io: TypedServer, socket: TypedSocket) {
  socket.on(EVENTS.PLAYLIST_GET_MY, async (data) => {
    // Validate platform — always answer one that was named, so the client never hangs
    const parsed = platformEventSchema.safeParse(data)
    if (!parsed.success) {
      const named = (data as { platform?: unknown } | null | undefined)?.platform
      if (typeof named === 'string')
        socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform: named as MusicSource, playlists: [] })
      return
    }
    const { platform } = parsed.data

    try {
      const mapping = roomRepo.getSocketMapping(socket.id)
      if (!mapping) {
        socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform, playlists: [] })
        return
      }

      const cookie = authService.getUserCookie(mapping.userId, platform, mapping.roomId)
      if (!cookie) {
        socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform, playlists: [] })
        return
      }

      // Every call below goes upstream with the user's cookie, so it shares the account-event budget.
      // The client is still answered (with nothing) so a pending request never hangs.
      if (!(await checkAuthRateLimit(socket))) {
        socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform, playlists: [] })
        return
      }

      socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform, playlists: await listUserPlaylists(platform, cookie) })
    } catch (err) {
      logger.error('PLAYLIST_GET_MY error', err, { socketId: socket.id })
      socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform, playlists: [] })
    }
  })
}
