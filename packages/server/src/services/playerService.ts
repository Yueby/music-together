import type { AudioQuality, MusicSource, PlayMode, PlayState, ScheduledPlayState, Track } from '@music-together/shared'
import { EVENTS, ERROR_CODE, NTP } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'
import { nanoid } from 'nanoid'
import { musicProvider } from './musicProvider.js'
import * as queueService from './queueService.js'
import * as trackFallbackService from './trackFallbackService.js'
import * as authService from './authService.js'
import { estimateCurrentTime } from './syncService.js'
import { isStreamUrlExpired } from './streamUrlLifetime.js'
import { resolveStreamUrl as resolveStreamUrlWithFallback } from './streamUrlResolver.js'
import { broadcastRoomList } from './roomLifecycleService.js'
import { toPublicRoomState } from '../utils/roomUtils.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import type { RoomData } from '../repositories/types.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

// ---------------------------------------------------------------------------
// Per-room mutex for playTrackInRoom (prevents concurrent execution)
// ---------------------------------------------------------------------------

const playMutexes = new Map<string, Promise<unknown>>()
const controlGenerations = new Map<string, number>()

function beginControl(roomId: string): number {
  const generation = (controlGenerations.get(roomId) ?? 0) + 1
  controlGenerations.set(roomId, generation)
  return generation
}

function playbackGuard(roomId: string, room: RoomData, generation = controlGenerations.get(roomId)) {
  const latest = getLatestPlayback(room)
  const trackId = latest.track?.id
  const revision = latest.playState.revision
  return () =>
    roomRepo.get(roomId) === room &&
    controlGenerations.get(roomId) === generation &&
    getLatestPlayback(room).track?.id === trackId &&
    getLatestPlayback(room).playState.revision === revision
}

function hasExpiredUrl(track: Track): boolean {
  return !!track.streamUrl && isStreamUrlExpired(track.source, track.streamUrl)
}

function emitStreamError(emit: TypedSocket['emit']): void {
  emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.STREAM_FAILED, message: '无法获取播放链接，请稍后重试' })
}

async function refreshTrackUrl(roomId: string, room: RoomData, track: Track): Promise<Track | null> {
  const cookie = authService.getAnyCookie(track.source, roomId)
  const url = await resolveStreamUrl(track.source, track.urlId, room.audioQuality, cookie ?? undefined)
  return url && !isStreamUrlExpired(track.source, url) ? { ...track, streamUrl: url } : null
}

async function refreshPlayback(
  io: TypedServer,
  roomId: string,
  room: RoomData,
  generation: number,
  seekTime?: number,
): Promise<void> {
  const valid = playbackGuard(roomId, room, generation)
  const track = getLatestPlayback(room).track!
  try {
    const fresh = await refreshTrackUrl(roomId, room, track)
    if (!valid()) return
    if (!fresh) {
      emitStreamError(io.to(roomId).emit.bind(io.to(roomId)))
      return
    }
    const latest = getLatestPlayback(room)
    const scheduleTime = getScheduleTime(roomId)
    const elapsed = latest.playState.isPlaying
      ? Math.max(0, (scheduleTime - latest.playState.serverTimestamp) / 1000)
      : 0
    const playState = scheduled(
      {
        isPlaying: seekTime === undefined ? true : latest.playState.isPlaying,
        currentTime: Math.min(
          fresh.duration > 0 ? fresh.duration : Infinity,
          seekTime ?? latest.playState.currentTime + elapsed,
        ),
        serverTimestamp: scheduleTime,
        revision: getNextRevision(room),
      },
      roomId,
      scheduleTime,
    )
    schedulePlaybackCommit(room, 'play', fresh, playState)
    io.to(roomId).emit(EVENTS.PLAYER_PLAY, { track: fresh, playState })
  } catch {
    if (valid()) emitStreamError(io.to(roomId).emit.bind(io.to(roomId)))
  }
}

// ---------------------------------------------------------------------------
// Auto fallback cooldown (prevents repeated attempts / ping-pong)
// ---------------------------------------------------------------------------

const autoFallbackCooldown = new Map<string, number>()

function canAutoFallback(roomId: string, trackId: string): boolean {
  const key = `${roomId}:${trackId}`
  const until = autoFallbackCooldown.get(key)
  if (!until) return true
  if (Date.now() >= until) {
    autoFallbackCooldown.delete(key)
    return true
  }
  return false
}

function markAutoFallback(roomId: string, trackId: string, ms: number): void {
  const key = `${roomId}:${trackId}`
  autoFallbackCooldown.set(key, Date.now() + ms)
}

function withPlayMutex<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
  const prev = playMutexes.get(roomId) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  playMutexes.set(roomId, next)
  // Cleanup entry when chain settles to avoid unbounded growth
  next.finally(() => {
    if (playMutexes.get(roomId) === next) playMutexes.delete(roomId)
  })
  return next
}

// ---------------------------------------------------------------------------
// Scheduled execution helpers
// ---------------------------------------------------------------------------

/**
 * Compute the future server-time at which all clients should execute an
 * action, based on the P90 RTT in the room.
 */
function getScheduleTime(roomId: string): number {
  const maxRTT = roomRepo.getP90RTT(roomId)
  const delay = Math.min(Math.max(maxRTT * 1.5 + 100, NTP.MIN_SCHEDULE_DELAY_MS), NTP.MAX_SCHEDULE_DELAY_MS)
  return Date.now() + delay
}

/** Build a ScheduledPlayState from a plain PlayState.
 *  Accepts an optional pre-computed scheduleTime to keep room state and
 *  broadcast payload consistent (same timestamp for both). */
function scheduled(ps: PlayState, roomId: string, scheduleTime?: number): ScheduledPlayState {
  return { ...ps, serverTimeToExecute: scheduleTime ?? getScheduleTime(roomId) }
}

function getLatestPlayback(room: RoomData): { track: Track | null; playState: PlayState } {
  return room.pendingPlayback
    ? { track: room.pendingPlayback.track, playState: room.pendingPlayback.playState }
    : { track: room.currentTrack, playState: room.playState }
}

function getNextRevision(room: RoomData): number {
  return Math.max(room.playState.revision, room.pendingPlayback?.playState.revision ?? -1) + 1
}

function cancelPendingPlayback(room: RoomData): void {
  if (room.pendingPlayback?.timer) clearTimeout(room.pendingPlayback.timer)
  room.pendingPlayback = null
}

function schedulePlaybackCommit(
  room: RoomData,
  type: NonNullable<RoomData['pendingPlayback']>['type'],
  track: Track | null,
  playState: ScheduledPlayState,
  onCommit?: () => void,
): void {
  cancelPendingPlayback(room)
  const delay = Math.max(0, playState.serverTimeToExecute - Date.now())
  const timer = setTimeout(() => {
    if (room.pendingPlayback?.playState !== playState) return
    room.currentTrack = track
    room.playState = {
      isPlaying: playState.isPlaying,
      currentTime: playState.currentTime,
      serverTimestamp: playState.serverTimestamp,
      revision: playState.revision,
    }
    room.pendingPlayback = null
    onCommit?.()
  }, delay)
  room.pendingPlayback = { type, track, playState, timer }
}

// ---------------------------------------------------------------------------
// Audio quality fallback
// ---------------------------------------------------------------------------

const resolveStreamUrl = (source: MusicSource, urlId: string, bitrate: AudioQuality, cookie?: string) =>
  resolveStreamUrlWithFallback(musicProvider, source, urlId, bitrate, cookie)

/**
 * Resolve stream URL / cover, set current track, and broadcast PLAYER_PLAY.
 * Returns true on success, false on failure.
 * Serialized per room via mutex to prevent concurrent state corruption.
 */
export function playTrackInRoom(io: TypedServer, roomId: string, track: Track): Promise<boolean> {
  const room = roomRepo.get(roomId)
  if (!room) return Promise.resolve(false)
  const generation = beginControl(roomId)
  return withPlayMutex(roomId, () =>
    roomRepo.get(roomId) === room && controlGenerations.get(roomId) === generation
      ? _playTrackInRoom(io, roomId, track, generation)
      : Promise.resolve(false),
  )
}

/**
 * Auto-play when the queue was empty. Re-checks `room.currentTrack` inside
 * the mutex so that concurrent QUEUE_ADD handlers don't both trigger playback
 * (the second caller sees the track set by the first and bails out).
 */
export function autoPlayIfEmpty(io: TypedServer, roomId: string, track: Track): Promise<boolean> {
  return withPlayMutex(roomId, async () => {
    const room = roomRepo.get(roomId)
    if (!room || getLatestPlayback(room).track) return false
    return _playTrackInRoom(io, roomId, track, beginControl(roomId))
  })
}

async function _playTrackInRoom(io: TypedServer, roomId: string, track: Track, generation: number): Promise<boolean> {
  const room = roomRepo.get(roomId)
  if (!room) return false

  const valid = playbackGuard(roomId, room, generation)
  if (!valid()) return false
  const resolved = { ...track }
  if (hasExpiredUrl(resolved)) resolved.streamUrl = undefined

  // Fetch stream URL if missing
  if (!resolved.streamUrl) {
    try {
      // Get cookie from the room's pool for this platform (enables VIP access)
      const cookie = authService.getAnyCookie(resolved.source, roomId)
      const url = await resolveStreamUrl(resolved.source, resolved.urlId, room.audioQuality, cookie ?? undefined)
      if (!valid()) return false

      if (!url) {
        const isVip = resolved.vip
        const hint = isVip && !cookie ? '（VIP 歌曲，需要有用户登录 VIP 账号）' : ''
        logger.warn(`Cannot get stream URL for "${resolved.title}"${hint}, removing from queue`, { roomId })

        // -------------------------------------------------------------------
        // Auto fallback (netease <-> tencent)
        // -------------------------------------------------------------------
        if (
          config.autoFallback.enabled &&
          (resolved.source === 'netease' || resolved.source === 'tencent') &&
          canAutoFallback(roomId, resolved.id)
        ) {
          // Prevent repeated fallback attempts for this queue item
          markAutoFallback(roomId, resolved.id, 60_000)
          const fromSource = resolved.source
          const trackTitle = resolved.title
          const toSource = trackFallbackService.getFallbackTargetSource(fromSource)
          if (toSource) {
            const attemptId = nanoid()
            io.to(roomId).emit(EVENTS.ROOM_AUTO_FALLBACK, {
              attemptId,
              status: 'trying',
              fromSource,
              toSource,
              trackTitle,
              reasonType: isVip && !cookie ? 'VIP_REQUIRED' : 'UNKNOWN',
              reasonDetail: isVip && !cookie ? 'VIP 歌曲未登录' : undefined,
            })

            try {
              const best = await trackFallbackService.findBestAlternativeTrack(resolved, toSource)
              if (!valid()) return false
              if (best) {
                const cookie2 = authService.getAnyCookie(best.track.source, roomId)
                const url2 = await resolveStreamUrl(
                  best.track.source,
                  best.track.urlId,
                  room.audioQuality,
                  cookie2 ?? undefined,
                )
                if (!valid()) return false
                if (url2) {
                  const replacement: Track = {
                    ...best.track,
                    id: resolved.id, // keep stable id so queue/current references remain consistent
                    requestedBy: resolved.requestedBy,
                    streamUrl: url2,
                  }

                  // Replace in queue (if present) before playing
                  const roomBefore = roomRepo.get(roomId)
                  if (roomBefore) {
                    roomBefore.queue = roomBefore.queue.map((t) => (t.id === resolved.id ? replacement : t))
                    io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: roomBefore.queue })
                  }

                  io.to(roomId).emit(EVENTS.ROOM_AUTO_FALLBACK, {
                    attemptId,
                    status: 'success',
                    fromSource,
                    toSource,
                    trackTitle,
                  })

                  // Continue playback with replacement
                  resolved.source = replacement.source
                  resolved.sourceId = replacement.sourceId
                  resolved.urlId = replacement.urlId
                  resolved.lyricId = replacement.lyricId
                  resolved.picId = replacement.picId
                  resolved.vip = replacement.vip
                  resolved.album = replacement.album
                  resolved.artist = replacement.artist
                  resolved.title = replacement.title
                  resolved.cover = replacement.cover
                  resolved.streamUrl = replacement.streamUrl
                }
              }
            } catch (fallbackErr) {
              if (!valid()) return false
              logger.error('Auto fallback failed', fallbackErr, { roomId })
            }

            if (!resolved.streamUrl) {
              io.to(roomId).emit(EVENTS.ROOM_AUTO_FALLBACK, {
                attemptId,
                status: 'failed',
                fromSource,
                toSource,
                trackTitle,
                reasonType: isVip && !cookie ? 'VIP_REQUIRED' : 'UNKNOWN',
              })
            }
          }
        }

        // If still no streamUrl, follow original failure path
        if (!resolved.streamUrl) {
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
      }
      resolved.streamUrl = url ?? resolved.streamUrl
    } catch (err) {
      if (!valid()) return false
      logger.error(`getStreamUrl failed for ${resolved.urlId}`, err, { roomId })
      // Auto-remove on unexpected failure too
      queueService.removeTrack(roomId, resolved.id)
      const room2 = roomRepo.get(roomId)
      if (room2) io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room2.queue })
      return false
    }
  }

  // The track may have been removed while an external stream/cover request was
  // in flight. Never commit a queue item that no longer exists.
  const roomBeforeCommit = roomRepo.get(roomId)
  if (!valid() || !roomBeforeCommit?.queue.some((item) => item.id === resolved.id)) return false

  // Fetch cover if missing
  if (!resolved.cover && resolved.picId) {
    try {
      const cover = await musicProvider.getCover(resolved.source, resolved.picId)
      if (cover) resolved.cover = cover
    } catch {
      // Non-critical, leave cover empty
    }
  }

  // Re-check after cover resolution too; queue removal can happen during either
  // external request.
  if (!valid() || !room.queue.some((item) => item.id === resolved.id)) return false
  if (hasExpiredUrl(resolved)) {
    emitStreamError(io.to(roomId).emit.bind(io.to(roomId)))
    return false
  }

  // Update room state — align serverTimestamp with the scheduled execution time
  // so that estimateCurrentTime() is accurate before the first conductor report.
  const scheduleTime = getScheduleTime(roomId)
  const playState = scheduled(
    {
      isPlaying: true,
      currentTime: 0,
      serverTimestamp: scheduleTime,
      revision: getNextRevision(room),
    },
    roomId,
    scheduleTime,
  )
  schedulePlaybackCommit(room, 'play', resolved, playState)

  io.to(roomId).emit(EVENTS.PLAYER_PLAY, {
    track: resolved,
    playState,
  })

  // 通知大厅用户当前播放曲目变化
  broadcastRoomList(io)

  logger.info(`Playing: ${resolved.title} in room ${roomId}`, { roomId })
  void preloadUpcoming(io, roomId)
  return true
}

// ---------------------------------------------------------------------------
// Preloading the next track
// ---------------------------------------------------------------------------

/**
 * What each room was last told to preload: repeated queue edits do not repeat the announcement, and a member who
 * joins mid-track (and so missed it) is told when it syncs.
 */
const announcedPreloads = new Map<string, { key: string; track: Track }>()

/**
 * Resolve the stream URL of the track that will most likely follow the current one and announce it, so clients can
 * fetch it while the current track plays. A member whose client has to download the whole file first (the mini-app)
 * would otherwise start several seconds into every new track.
 *
 * Only transitions that are known in advance qualify: shuffle is picked at the moment of the change and loop-one
 * replays the current track. The resolved URL is also kept on the queue item, which makes the real transition skip
 * the provider round trip. A failure here is silent: the normal play path still resolves, falls back and reports.
 */
export async function preloadUpcoming(io: TypedServer, roomId: string): Promise<void> {
  const room = roomRepo.get(roomId)
  if (!room) {
    announcedPreloads.delete(roomId)
    return
  }
  const current = getLatestPlayback(room).track
  if (!current || room.playMode === 'shuffle' || room.playMode === 'loop-one') return
  const next = queueService.getNextTrack(roomId, room.playMode, current.id)
  if (!next || next.id === current.id) {
    announcedPreloads.delete(roomId)
    return
  }
  const key = `${next.id}:${next.urlId}:${room.audioQuality}`
  if (announcedPreloads.get(roomId)?.key === key && next.streamUrl && !hasExpiredUrl(next)) return

  try {
    // Always resolve afresh: a URL left on the item may belong to another audio quality.
    const fresh = await refreshTrackUrl(roomId, room, next)
    // Anything may have changed while the provider answered.
    const latest = roomRepo.get(roomId)
    if (!fresh || latest !== room || getLatestPlayback(room).track?.id !== current.id) return
    const item = room.queue.find((track) => track.id === next.id)
    if (!item) return
    item.streamUrl = fresh.streamUrl
    announcedPreloads.set(roomId, { key, track: item })
    io.to(roomId).emit(EVENTS.PLAYER_PRELOAD, { track: item })
  } catch (error) {
    logger.warn('Preload of the next track failed', { roomId, reason: error instanceof Error ? error.name : 'unknown' })
  }
}

export function resumeTrack(io: TypedServer, roomId: string, _initiatorSocket?: TypedSocket): void {
  const room = roomRepo.get(roomId)
  if (!room) return
  const latest = getLatestPlayback(room)
  if (!latest.track) return
  const generation = beginControl(roomId)
  if (hasExpiredUrl(latest.track)) {
    void refreshPlayback(io, roomId, room, generation)
    return
  }

  const scheduleTime = getScheduleTime(roomId)
  const playState = scheduled(
    {
      ...latest.playState,
      isPlaying: true,
      serverTimestamp: scheduleTime,
      revision: getNextRevision(room),
    },
    roomId,
    scheduleTime,
  )
  schedulePlaybackCommit(room, 'resume', latest.track, playState)
  io.to(roomId).emit(EVENTS.PLAYER_RESUME, { playState })
}

export function pauseTrack(io: TypedServer, roomId: string, _initiatorSocket?: TypedSocket): void {
  const room = roomRepo.get(roomId)
  if (!room) return

  const latest = getLatestPlayback(room)
  if (!latest.track) return
  beginControl(roomId)
  const scheduleTime = getScheduleTime(roomId)
  // Base replacements on the latest planned state, not an older committed action.
  const effectiveStartTime = Math.max(Date.now(), latest.playState.serverTimestamp)
  const delaySec = latest.playState.isPlaying ? Math.max(0, (scheduleTime - effectiveStartTime) / 1000) : 0
  const latestElapsed = latest.playState.isPlaying
    ? Math.max(0, (Date.now() - latest.playState.serverTimestamp) / 1000)
    : 0
  const snapshotTime = Math.min(
    latest.track.duration > 0 ? latest.track.duration : Number.POSITIVE_INFINITY,
    latest.playState.currentTime + latestElapsed + delaySec,
  )
  const playState = scheduled(
    {
      isPlaying: false,
      currentTime: snapshotTime,
      serverTimestamp: scheduleTime,
      revision: getNextRevision(room),
    },
    roomId,
    scheduleTime,
  )
  schedulePlaybackCommit(room, 'pause', latest.track, playState)
  io.to(roomId).emit(EVENTS.PLAYER_PAUSE, { playState })
}

export function seekTrack(io: TypedServer, roomId: string, currentTime: number, _initiatorSocket?: TypedSocket): void {
  if (!Number.isFinite(currentTime) || currentTime < 0) return
  const room = roomRepo.get(roomId)
  if (!room) return

  const latest = getLatestPlayback(room)
  if (!latest.track) return
  const generation = beginControl(roomId)
  if (hasExpiredUrl(latest.track)) {
    void refreshPlayback(io, roomId, room, generation, currentTime)
    return
  }
  const scheduleTime = getScheduleTime(roomId)
  // Duration metadata can be missing (0) for some sources; retain finite,
  // non-negative validation without imposing an arbitrary upper bound.
  const seekCap = latest.track.duration > 0 ? latest.track.duration : Number.POSITIVE_INFINITY
  const clampedTime = Math.min(Math.max(0, currentTime), seekCap)
  const playState = scheduled(
    {
      ...latest.playState,
      currentTime: clampedTime,
      serverTimestamp: latest.playState.isPlaying ? scheduleTime : Date.now(),
      revision: getNextRevision(room),
    },
    roomId,
    scheduleTime,
  )
  schedulePlaybackCommit(room, 'seek', latest.track, playState)
  io.to(roomId).emit(EVENTS.PLAYER_SEEK, { playState })
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
    beginControl(roomId)
    cancelPendingPlayback(room)
    room.currentTrack = track
    room.playState = {
      isPlaying: track !== null,
      currentTime: 0,
      serverTimestamp: Date.now(),
      revision: getNextRevision(room),
    }
  }
}

/**
 * Stop playback: clear current track, emit PLAYER_PAUSE with a stopped state,
 * broadcast full ROOM_STATE so clients clear stale track, and notify lobby.
 * Used when no next track is available (queue empty, track removed, queue cleared).
 */
export function stopPlayback(io: TypedServer, roomId: string): void {
  const room = roomRepo.get(roomId)
  if (!room) return
  beginControl(roomId)

  const scheduleTime = getScheduleTime(roomId)
  const playState = scheduled(
    {
      isPlaying: false,
      currentTime: 0,
      serverTimestamp: scheduleTime,
      revision: getNextRevision(room),
    },
    roomId,
    scheduleTime,
  )
  schedulePlaybackCommit(room, 'stop', null, playState, () => {
    io.to(roomId).emit(EVENTS.ROOM_STATE, toPublicRoomState(room))
    broadcastRoomList(io)
  })
  io.to(roomId).emit(EVENTS.PLAYER_PAUSE, { playState })
}

/**
 * Mutex-protected variant of `stopPlayback`. Use when the caller is NOT
 * already inside the per-room mutex (e.g. QUEUE_CLEAR) to prevent races
 * with concurrent `autoPlayIfEmpty` / `_playTrackInRoom` operations.
 */
export function stopPlaybackSafe(io: TypedServer, roomId: string): Promise<void> {
  const room = roomRepo.get(roomId)
  if (!room) return Promise.resolve()
  const generation = beginControl(roomId)
  return withPlayMutex(roomId, async () => {
    if (roomRepo.get(roomId) === room && controlGenerations.get(roomId) === generation) stopPlayback(io, roomId)
  })
}

// ---------------------------------------------------------------------------
// Next / Previous track (debounce + queue navigation inside mutex)
// ---------------------------------------------------------------------------

/**
 * Accept controls before entering the mutex so in-flight URL requests become
 * stale immediately; queue navigation remains serialized.
 */
export function playNextTrackInRoom(
  io: TypedServer,
  roomId: string,
  playMode: PlayMode,
  options?: { skipDebounce?: boolean },
): Promise<void> {
  const room = roomRepo.get(roomId)
  if (!room || (!options?.skipDebounce && _isSkipDebounced(roomId, 'next'))) return Promise.resolve()
  lastSkipTimestamp.set(roomId, { action: 'next', timestamp: Date.now() })
  const generation = beginControl(roomId)
  const valid = () => roomRepo.get(roomId) === room && controlGenerations.get(roomId) === generation
  return withPlayMutex(roomId, async () => {
    if (!valid()) return
    const nextTrack = queueService.getNextTrack(roomId, playMode)
    if (!nextTrack) {
      stopPlayback(io, roomId)
      return
    }

    const success = await _playTrackInRoom(io, roomId, nextTrack, generation)
    if (!valid()) return
    if (!success) {
      const skipTrack = queueService.getNextTrack(roomId, playMode)
      if (skipTrack) await _playTrackInRoom(io, roomId, skipTrack, generation)
    }

    // Keep duplicate controls debounced immediately after URL resolution too.
    lastSkipTimestamp.set(roomId, { action: 'next', timestamp: Date.now() })
  })
}

/**
 * Go to the previous track in the queue. Same mutex serialization as next.
 */
export function playPrevTrackInRoom(
  io: TypedServer,
  roomId: string,
  options?: { skipDebounce?: boolean },
): Promise<void> {
  const room = roomRepo.get(roomId)
  if (!room || (!options?.skipDebounce && _isSkipDebounced(roomId, 'prev'))) return Promise.resolve()
  lastSkipTimestamp.set(roomId, { action: 'prev', timestamp: Date.now() })
  const generation = beginControl(roomId)
  const valid = () => roomRepo.get(roomId) === room && controlGenerations.get(roomId) === generation
  return withPlayMutex(roomId, async () => {
    if (!valid()) return
    const prevTrack = queueService.getPreviousTrack(roomId)
    if (!prevTrack) return

    const success = await _playTrackInRoom(io, roomId, prevTrack, generation)
    if (!valid()) return
    if (!success) {
      const skipTrack = queueService.getPreviousTrack(roomId)
      if (skipTrack) await _playTrackInRoom(io, roomId, skipTrack, generation)
    }

    // Refresh debounce timestamp after async work (same rationale as playNextTrackInRoom)
    lastSkipTimestamp.set(roomId, { action: 'prev', timestamp: Date.now() })
  })
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
  await syncCurrentPlayback(io, socket, roomId, room)
  // Someone who joins mid-track missed the announcement of the next one: without it their client would still
  // start the next track cold, seconds behind everybody else.
  const upcoming = announcedPreloads.get(roomId)
  if (upcoming && roomRepo.getSocketMapping(socket.id)?.roomId === roomId) {
    socket.emit(EVENTS.PLAYER_PRELOAD, { track: upcoming.track })
  }
}

async function syncCurrentPlayback(
  io: TypedServer,
  socket: TypedSocket,
  roomId: string,
  room: RoomData,
): Promise<void> {
  const isAloneInRoom = room.users.length === 1
  let joinTrack = getLatestPlayback(room).track
  if (joinTrack && hasExpiredUrl(joinTrack)) {
    if (!room.pendingPlayback && isAloneInRoom && !room.playState.isPlaying) {
      resumeTrack(io, roomId)
      return
    }
    const valid = playbackGuard(roomId, room)
    const stillJoined = () => valid() && roomRepo.getSocketMapping(socket.id)?.roomId === roomId
    try {
      joinTrack = await refreshTrackUrl(roomId, room, joinTrack)
    } catch {
      joinTrack = null
    }
    if (!stillJoined()) return
    if (!joinTrack) emitStreamError(socket.emit.bind(socket))
  }

  const pending = room.pendingPlayback
  if (pending) {
    if (joinTrack?.streamUrl) {
      socket.emit(EVENTS.PLAYER_PLAY, {
        track: joinTrack,
        playState: pending.playState,
      })
    }
    if (pending.type === 'stop' || pending.type === 'pause' || pending.type === 'seek') {
      const event = pending.type === 'stop' || pending.type === 'pause' ? EVENTS.PLAYER_PAUSE : EVENTS.PLAYER_SEEK
      socket.emit(event, { playState: pending.playState })
    } else if (pending.type === 'resume') {
      socket.emit(EVENTS.PLAYER_RESUME, { playState: pending.playState })
    }
    return
  } else if (room.currentTrack?.streamUrl) {
    if (!joinTrack) return
    // Alone in room + track was paused → schedule the same auto-resume used by direct controls.
    if (isAloneInRoom && !room.playState.isPlaying && !hasExpiredUrl(room.currentTrack)) {
      resumeTrack(io, roomId)
      const resumeState = room.pendingPlayback?.playState
      if (resumeState) {
        socket.emit(EVENTS.PLAYER_PLAY, { track: joinTrack, playState: resumeState })
      }
      return
    }

    const shouldAutoPlay = room.playState.isPlaying
    const snapshotCurrentTime = estimateCurrentTime(roomId)
    const snapshotTimestamp = Date.now()
    const joinCalibrationDelayMs = NTP.INITIAL_INTERVAL_MS * NTP.MAX_INITIAL_SAMPLES + 100
    const scheduleTime = shouldAutoPlay
      ? Math.max(getScheduleTime(roomId), snapshotTimestamp + joinCalibrationDelayMs)
      : snapshotTimestamp
    const delaySec = shouldAutoPlay ? Math.max(0, (scheduleTime - snapshotTimestamp) / 1000) : 0
    const scheduledCurrentTime = Math.min(
      room.currentTrack.duration > 0 ? room.currentTrack.duration : Number.POSITIVE_INFINITY,
      snapshotCurrentTime + delaySec,
    )

    socket.emit(EVENTS.PLAYER_PLAY, {
      track: joinTrack,
      playState: {
        isPlaying: shouldAutoPlay,
        currentTime: scheduledCurrentTime,
        serverTimestamp: scheduleTime,
        serverTimeToExecute: scheduleTime,
        revision: room.playState.revision,
      },
    })
  } else if (isAloneInRoom && room.queue.length > 0) {
    // No current track but queue has items → start playing from queue
    const firstTrack = room.queue[0]
    await playTrackInRoom(io, roomId, firstTrack)
  }
}

// ---------------------------------------------------------------------------
// Room cleanup, debounce & conductor report validation
// ---------------------------------------------------------------------------

/** Debounce repeated skip actions without blocking an immediate direction reversal. */
const lastSkipTimestamp = new Map<string, { action: 'next' | 'prev'; timestamp: number }>()

/** Max allowed backward drift (seconds) between conductor report and server estimate. */
const CONDUCTOR_REJECT_DRIFT_THRESHOLD_S = 3

/** Remove per-room entries for a deleted room */
export function cleanupRoom(roomId: string): void {
  lastSkipTimestamp.delete(roomId)
  playMutexes.delete(roomId)
  controlGenerations.delete(roomId)
  announcedPreloads.delete(roomId)
  const room = roomRepo.get(roomId)
  if (room) cancelPendingPlayback(room)
}

/** Reject reports that would move the authoritative room position backwards by seconds. */
export function validateConductorReport(_roomId: string, reportedTime: number, estimatedTime: number): boolean {
  return estimatedTime - reportedTime <= CONDUCTOR_REJECT_DRIFT_THRESHOLD_S
}

/** Debounce only duplicate NEXT or duplicate PREV actions for a room. */
function _isSkipDebounced(roomId: string, action: 'next' | 'prev'): boolean {
  const now = Date.now()
  const last = lastSkipTimestamp.get(roomId)
  if (last?.action === action && now - last.timestamp < config.player.nextDebounceMs) return true
  lastSkipTimestamp.set(roomId, { action, timestamp: now })
  return false
}
