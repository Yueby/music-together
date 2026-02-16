import { EVENTS } from '@music-together/shared'
import type { MusicSource } from '@music-together/shared'
import * as authService from '../services/authService.js'
import * as neteaseAuth from '../services/neteaseAuthService.js'
import * as kugouAuth from '../services/kugouAuthService.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

const VALID_PLATFORMS = new Set<MusicSource>(['netease', 'tencent', 'kugou'])

export function registerPlaylistController(io: TypedServer, socket: TypedSocket) {
  socket.on(EVENTS.PLAYLIST_GET_MY, async (data) => {
    const platform: MusicSource | undefined = data?.platform

    // Validate platform — always emit a response so client never hangs
    if (!platform || !VALID_PLATFORMS.has(platform)) {
      if (platform) socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform, playlists: [] })
      return
    }

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

      if (platform === 'netease') {
        const playlists = await neteaseAuth.getUserPlaylists(cookie)
        socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform, playlists })
      } else if (platform === 'kugou') {
        const playlists = await kugouAuth.getUserPlaylists(cookie)
        socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform, playlists })
      } else {
        // Tencent: user playlist discovery not yet supported
        socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform, playlists: [] })
      }
    } catch (err) {
      logger.error('PLAYLIST_GET_MY error', err, { socketId: socket.id })
      socket.emit(EVENTS.PLAYLIST_MY_LIST, { platform, playlists: [] })
    }
  })
}
