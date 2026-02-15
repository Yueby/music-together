import type { AudioQuality, MusicSource, PlayState, ScheduledPlayState, Track } from '@music-together/shared'
import { EVENTS, ERROR_CODE, NTP } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'
import { musicProvider } from './musicProvider.js'
import * as queueService from './queueService.js'
import * as authService from './authService.js'
import { estimateCurrentTime } from './syncService.js'
import { broadcastRoomList } from './roomLifecycleService.js'
import { toPublicRoomState } from '../utils/roomUtils.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import type { RoomData } from '../repositories/types.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

// ---------------------------------------------------------------------------
// Scheduled execution helpers
// ---------------------------------------------------------------------------

/**
 * Compute the future server-time at which all clients should execute an
 * action, based on the P90 RTT in the room.
 */
function getScheduleTime(roomId: string): number {
  const maxRTT = roomRepo.getP90RTT(roomId)
  const delay = Math.min(
    Math.max(maxRTT * 1.5 + 100, NTP.MIN_SCHEDULE_DELAY_MS),
    NTP.MAX_SCHEDULE_DELAY_MS,
  )
  return Date.now() + delay
}

/** Build a ScheduledPlayState from a plain PlayState.
 *  Accepts an optional pre-computed scheduleTime to keep room state and
 *  broadcast payload consistent (same timestamp for both). */
function scheduled(ps: PlayState, roomId: string, scheduleTime?: number): ScheduledPlayState {
  return { ...ps, serverTimeToExecute: scheduleTime ?? getScheduleTime(roomId) }
}

// ---------------------------------------------------------------------------
// Audio quality fallback
// ---------------------------------------------------------------------------

/** Ordered fallback bitrates for each quality tier */
const BITRATE_FALLBACKS: Record<AudioQuality, AudioQuality[]> = {
  999: [320, 192, 128],
  320: [192, 128],
  192: [128],
  128: [],
}

/**
 * Try to get a stream URL at the requested bitrate. If it fails, try each
 * lower tier in order until one succeeds or all options are exhausted.
 */
async function resolveStreamUrl(
  source: MusicSource,
  urlId: string,
  bitrate: AudioQuality,
  cookie?: string,
): Promise<string | null> {
  const url = await musicProvider.getStreamUrl(source, urlId, bitrate, cookie)
  if (url) return url

  // Fallback to lower bitrates
  for (const fallback of BITRATE_FALLBACKS[bitrate]) {
    const fallbackUrl = await musicProvider.getStreamUrl(source, urlId, fallback, cookie)
    if (fallbackUrl) {
      logger.info(`Bitrate fallback: ${bitrate} -> ${fallback} for ${source}/${urlId}`)
      return fallbackUrl
    }
  }

  return null
}

/**
 * Resolve stream URL / cover, set current track, and broadcast PLAYER_PLAY.
 * Returns true on success, false on failure.
 */
export async function playTrackInRoom(
  io: TypedServer,
  roomId: string,
  track: Track,
): Promise<boolean> {
  const room = roomRepo.get(roomId)
  if (!room) return false

  const resolved = { ...track }

  // Fetch stream URL if missing
  if (!resolved.streamUrl) {
    try {
      // Get cookie from the room's pool for this platform (enables VIP access)
      const cookie = authService.getAnyCookie(resolved.source, roomId)
      const url = await resolveStreamUrl(resolved.source, resolved.urlId, room.audioQuality, cookie ?? undefined)

      if (!url) {
        const isVip = resolved.vip
        const hint = isVip && !cookie
          ? '（VIP 歌曲，需要有用户登录 VIP 账号）'
          : ''
        logger.warn(`Cannot get stream URL for "${resolved.title}"${hint}, removing from queue`, { roomId })
        // Auto-remove the invalid track from the queue
        queueService.removeTrack(roomId, resolved.id)
        const room2 = roomRepo.get(roomId)
        if (room2) io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room2.queue })
        io.to(roomId).emit(EVENTS.ROOM_ERROR, {
          code: ERROR_CODE.STREAM_FAILED,
          message: `无法获取「${resolved.title}」的播放链接${hint}，已从列表移除`,
        })
        return false
      }
      resolved.streamUrl = url
    } catch (err) {
      logger.error(`getStreamUrl failed for ${resolved.urlId}`, err, { roomId })
      // Auto-remove on unexpected failure too
      queueService.removeTrack(roomId, resolved.id)
      const room2 = roomRepo.get(roomId)
      if (room2) io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room2.queue })
      return false
    }
  }

  // Fetch cover if missing
  if (!resolved.cover && resolved.picId) {
    try {
      const cover = await musicProvider.getCover(resolved.source, resolved.picId)
      if (cover) resolved.cover = cover
    } catch {
      // Non-critical, leave cover empty
    }
  }

  // Update room state — align serverTimestamp with the scheduled execution time
  // so that estimateCurrentTime() is accurate before the first host report.
  room.currentTrack = resolved
  const scheduleTime = getScheduleTime(roomId)
  room.playState = {
    isPlaying: true,
    currentTime: 0,
    serverTimestamp: scheduleTime,
  }

  io.to(roomId).emit(EVENTS.PLAYER_PLAY, {
    track: resolved,
    playState: scheduled(room.playState, roomId, scheduleTime),
  })

  // 通知大厅用户当前播放曲目变化
  broadcastRoomList(io)

  logger.info(`Playing: ${resolved.title} in room ${roomId}`, { roomId })
  return true
}

export function resumeTrack(io: TypedServer, roomId: string, _initiatorSocket?: TypedSocket): void {
  const room = roomRepo.get(roomId)
  if (!room || !room.currentTrack) return

  const scheduleTime = getScheduleTime(roomId)
  room.playState = { ...room.playState, isPlaying: true, serverTimestamp: scheduleTime }
  // All clients (including initiator) must execute at the same scheduled moment
  io.to(roomId).emit(EVENTS.PLAYER_RESUME, { playState: scheduled(room.playState, roomId, scheduleTime) })
}

export function pauseTrack(io: TypedServer, roomId: string, _initiatorSocket?: TypedSocket): void {
  const room = roomRepo.get(roomId)
  if (!room) return

  // Snapshot estimated position before pausing so resume starts from the correct point
  const snapshotTime = estimateCurrentTime(roomId)
  room.playState = { isPlaying: false, currentTime: snapshotTime, serverTimestamp: Date.now() }
  // All clients must pause at the same scheduled moment
  io.to(roomId).emit(EVENTS.PLAYER_PAUSE, { playState: scheduled(room.playState, roomId) })
}

export function seekTrack(io: TypedServer, roomId: string, currentTime: number, _initiatorSocket?: TypedSocket): void {
  const room = roomRepo.get(roomId)
  if (!room) return

  const scheduleTime = getScheduleTime(roomId)
  // When playing, align serverTimestamp with scheduled time so estimateCurrentTime() is accurate
  room.playState = {
    ...room.playState,
    currentTime,
    serverTimestamp: room.playState.isPlaying ? scheduleTime : Date.now(),
  }
  // All clients must seek at the same scheduled moment
  io.to(roomId).emit(EVENTS.PLAYER_SEEK, { playState: scheduled(room.playState, roomId, scheduleTime) })
}

export function updatePlayState(roomId: string, update: Partial<PlayState>): void {
  const room = roomRepo.get(roomId)
  if (room) {
    room.playState = { ...room.playState, ...update, serverTimestamp: Date.now() }
  }
}

export function setCurrentTrack(roomId: string, track: Track | null): void {
  const room = roomRepo.get(roomId)
  if (room) {
    room.currentTrack = track
    room.playState = {
      isPlaying: track !== null,
      currentTime: 0,
      serverTimestamp: Date.now(),
    }
  }
}

/**
 * Stop playback: clear current track, emit PLAYER_PAUSE with a stopped state,
 * broadcast full ROOM_STATE so clients clear stale track, and notify lobby.
 * Used when no next track is available (queue empty, track removed, queue cleared).
 */
export function stopPlayback(io: TypedServer, roomId: string): void {
  setCurrentTrack(roomId, null)
  io.to(roomId).emit(EVENTS.PLAYER_PAUSE, {
    playState: { isPlaying: false, currentTime: 0, serverTimestamp: Date.now(), serverTimeToExecute: Date.now() },
  })
  const room = roomRepo.get(roomId)
  if (room) {
    io.to(roomId).emit(EVENTS.ROOM_STATE, toPublicRoomState(room))
  }
  broadcastRoomList(io)
}

// ---------------------------------------------------------------------------
// Playback sync for newly-joined clients
// ---------------------------------------------------------------------------

/**
 * Send current playback state to a socket that just joined a room.
 * Handles auto-resume when alone, and auto-play from queue.
 */
export async function syncPlaybackToSocket(
  io: TypedServer,
  socket: TypedSocket,
  roomId: string,
  room: RoomData,
): Promise<void> {
  const isAloneInRoom = room.users.length === 1

  if (room.currentTrack?.streamUrl) {
    // Alone in room + track was paused → auto-resume (host rejoining)
    const shouldAutoPlay = isAloneInRoom || room.playState.isPlaying
    if (isAloneInRoom && !room.playState.isPlaying) {
      room.playState = { ...room.playState, isPlaying: true, serverTimestamp: Date.now() }
    }
    socket.emit(EVENTS.PLAYER_PLAY, {
      track: room.currentTrack,
      playState: {
        isPlaying: shouldAutoPlay,
        currentTime: estimateCurrentTime(roomId),
        serverTimestamp: Date.now(),
        serverTimeToExecute: Date.now(),
      },
    })
  } else if (isAloneInRoom && room.queue.length > 0) {
    // No current track but queue has items → start playing from queue
    const firstTrack = room.queue[0]
    await playTrackInRoom(io, roomId, firstTrack)
  }
}

// ---------------------------------------------------------------------------
// Room cleanup, debounce & host report validation
// ---------------------------------------------------------------------------

/** Debounce tracking for PLAYER_NEXT per room */
const lastNextTimestamp = new Map<string, number>()

/** Track consecutive rejected host reports per room to break deadlocks */
const hostRejectCount = new Map<string, number>()
const HOST_REJECT_FORCE_ACCEPT = 3

/** Remove per-room entries for a deleted room */
export function cleanupRoom(roomId: string): void {
  lastNextTimestamp.delete(roomId)
  hostRejectCount.delete(roomId)
}

/**
 * Validate a host sync report against the server estimate.
 * Returns true if the report should be ACCEPTED, false if rejected (stale).
 * Automatically force-accepts after HOST_REJECT_FORCE_ACCEPT consecutive
 * rejections to break deadlocks when the server estimate has diverged.
 */
export function validateHostReport(roomId: string, reportedTime: number, estimatedTime: number): boolean {
  if (estimatedTime - reportedTime > 1) {
    const count = (hostRejectCount.get(roomId) ?? 0) + 1
    hostRejectCount.set(roomId, count)
    if (count < HOST_REJECT_FORCE_ACCEPT) {
      return false // reject
    }
    // Too many consecutive rejections — force accept to break deadlock
    logger.warn(`Force-accepting host report after ${count} consecutive rejections`, { roomId })
  }
  // Accepted — reset counter
  hostRejectCount.delete(roomId)
  return true
}

/**
 * Check and update the next-track debounce for a room.
 * Returns true if the action should be SKIPPED (too soon), false if allowed.
 */
export function isNextDebounced(roomId: string): boolean {
  const now = Date.now()
  const lastNext = lastNextTimestamp.get(roomId) ?? 0
  if (now - lastNext < config.player.nextDebounceMs) return true
  lastNextTimestamp.set(roomId, now)
  return false
}
