import type { AudioQuality, MusicSource, PlayMode, PlayState, ScheduledPlayState, Track } from '@music-together/shared'
import { EVENTS, ERROR_CODE, NTP, TIMING, effectivePlayMode } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'
import { musicProvider } from './musicProvider.js'
import * as queueService from './queueService.js'
import { resolvePlayableTrack } from './trackFallbackService.js'
import * as authService from './authService.js'
import { estimateCurrentTime } from './syncService.js'
import { isStreamUrlExpired } from './streamUrlLifetime.js'
import { resolveStreamUrl as resolveStreamUrlWithFallback } from './streamUrlResolver.js'
import { broadcastRoomList } from './roomLifecycleService.js'
import { registerRoomCleanup } from './roomCleanupRegistry.js'
import { toPublicRoomState } from '../utils/roomUtils.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { fallbackCooldown } from './fallbackCooldown.js'
import type { PendingPrepare, RoomData } from '../repositories/types.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

// ---------------------------------------------------------------------------
// Per-room mutex for playTrackInRoom (prevents concurrent execution)
// ---------------------------------------------------------------------------

const playMutexes = new Map<string, Promise<unknown>>()
const controlGenerations = new Map<string, number>()
type PrepareSnapshot = Pick<PendingPrepare, 'track' | 'startAt'>
const interruptedPrepares = new WeakMap<RoomData, PrepareSnapshot>()
const endOfTrackTimers = new Map<string, ReturnType<typeof setTimeout>>()
const END_OF_TRACK_GRACE_MS = 5_000

function beginControl(roomId: string, room: RoomData): number {
  interruptedPrepares.delete(room)
  cancelPrepare(room)
  cancelEndOfTrack(roomId)
  const generation = (controlGenerations.get(roomId) ?? 0) + 1
  controlGenerations.set(roomId, generation)
  return generation
}

function beginTrackSwitch(roomId: string, room: RoomData) {
  const activePrepare = room.pendingPrepare
  const prepare = activePrepare
    ? { track: activePrepare.track, startAt: activePrepare.startAt }
    : interruptedPrepares.get(room)
  const generation = beginControl(roomId, room)
  if (prepare) interruptedPrepares.set(room, prepare)
  return { prepare, generation }
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
  wasPreparing = false,
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
    if (wasPreparing) {
      scheduleTrackStart(io, roomId, room, fresh, seekTime)
      return
    }
    const latest = getLatestPlayback(room)
    const scheduleTime = getScheduleTime(roomId)
    const elapsed = latest.playState.isPlaying
      ? Math.max(0, (scheduleTime - latest.playState.serverTimestamp) / 1000)
      : 0
    const playState = scheduled(
      {
        isPlaying: seekTime === undefined || latest.playState.isPlaying,
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
    schedulePlaybackCommit(io, room, 'play', fresh, playState)
    io.to(roomId).emit(EVENTS.PLAYER_PLAY, { track: fresh, playState })
  } catch {
    if (valid()) emitStreamError(io.to(roomId).emit.bind(io.to(roomId)))
  } finally {
    restoreEndOfTrack(io, room, generation)
  }
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

export function getLatestPlayback(room: RoomData): { track: Track | null; playState: PlayState } {
  if (room.pendingPrepare) return { track: room.pendingPrepare.track, playState: room.playState }
  return room.pendingPlayback
    ? { track: room.pendingPlayback.track, playState: room.pendingPlayback.playState }
    : { track: room.currentTrack, playState: room.playState }
}

function getNextRevision(room: RoomData): number {
  return Math.max(room.playState.revision, room.pendingPlayback?.playState.revision ?? -1, room.pendingPrepare?.revision ?? -1) + 1
}

function cancelPrepare(room: RoomData): void {
  if (!room.pendingPrepare) return
  clearTimeout(room.pendingPrepare.timer)
  room.pendingPrepare = null
}

function cancelEndOfTrack(roomId: string): void {
  const timer = endOfTrackTimers.get(roomId)
  if (timer === undefined) return
  clearTimeout(timer)
  endOfTrackTimers.delete(roomId)
}

function scheduleEndOfTrack(io: TypedServer, room: RoomData, track: Track | null, playState: PlayState, elapsedMs = 0): void {
  const roomId = room.id
  cancelEndOfTrack(roomId)
  if (!playState.isPlaying || !track || track.duration <= 0) return

  const delay = Math.max(0, (track.duration - playState.currentTime) * 1000) + END_OF_TRACK_GRACE_MS
  const timer = setTimeout(() => {
    if (endOfTrackTimers.get(roomId) !== timer) return
    endOfTrackTimers.delete(roomId)
    if (
      roomRepo.get(roomId) !== room || room.pendingPrepare || room.pendingPlayback ||
      room.currentTrack?.id !== track.id || !room.playState.isPlaying || room.playState.revision !== playState.revision
    ) return
    void playNextTrackInRoom(io, roomId, room.playMode, {
      expectedTrackId: track.id,
      expectedRevision: playState.revision,
      skipDebounce: true,
    })
  }, Math.max(0, delay - elapsedMs))
  timer.unref?.()
  endOfTrackTimers.set(roomId, timer)
}

/** Keep the original end time when a control leaves the current playback running. */
function restoreEndOfTrack(io: TypedServer, room: RoomData, generation: number): void {
  if (roomRepo.get(room.id) !== room || controlGenerations.get(room.id) !== generation) return
  if (room.pendingPrepare || room.pendingPlayback || endOfTrackTimers.has(room.id)) return
  const track = room.currentTrack
  if (!room.playState.isPlaying || !track || track.duration <= 0) return
  const elapsedMs = Math.max(0, Date.now() - room.playState.serverTimestamp)
  if (elapsedMs >= Math.max(0, (track.duration - room.playState.currentTime) * 1000) + END_OF_TRACK_GRACE_MS) return
  scheduleEndOfTrack(io, room, track, room.playState, elapsedMs)
}

function cancelPendingPlayback(room: RoomData): void {
  cancelEndOfTrack(room.id)
  if (room.pendingPlayback?.timer) clearTimeout(room.pendingPlayback.timer)
  room.pendingPlayback = null
}

function schedulePlaybackCommit(
  io: TypedServer,
  room: RoomData,
  type: NonNullable<RoomData['pendingPlayback']>['type'],
  track: Track | null,
  playState: ScheduledPlayState,
  onCommit?: () => void,
): void {
  cancelPendingPlayback(room)
  const delay = Math.max(0, playState.serverTimeToExecute - Date.now())
  const timer = setTimeout(() => {
    if (roomRepo.get(room.id) !== room || room.pendingPlayback?.playState !== playState) return
    room.currentTrack = track
    room.playState = {
      isPlaying: playState.isPlaying,
      currentTime: playState.currentTime,
      serverTimestamp: playState.serverTimestamp,
      revision: playState.revision,
    }
    room.pendingPlayback = null
    scheduleEndOfTrack(io, room, track, playState)
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
  const { prepare, generation } = beginTrackSwitch(roomId, room)
  return withPlayMutex(roomId, async () => {
    if (roomRepo.get(roomId) !== room || controlGenerations.get(roomId) !== generation) return false
    const played = await _playTrackInRoom(io, roomId, track, generation)
    if (!played) restorePlaybackAfterFailedSwitch(io, room, generation, prepare)
    return played
  })
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
    return _playTrackInRoom(io, roomId, track, beginControl(roomId, room))
  })
}

async function _playTrackInRoom(io: TypedServer, roomId: string, track: Track, generation: number): Promise<boolean> {
  const room = roomRepo.get(roomId)
  if (!room) return false

  const valid = playbackGuard(roomId, room, generation)
  if (!valid()) return false
  const resolved = await resolvePlayableTrack(io, room, track, valid)
  if (!resolved) return false

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

  interruptedPrepares.delete(room)
  plannedShuffleNext.delete(roomId)
  announcedPreloads.delete(roomId)
  const socketIds = roomRepo.getRoomSocketIds(roomId)
  if (socketIds.length === 0) {
    scheduleTrackStart(io, roomId, room, resolved)
    return true
  }

  const revision = getNextRevision(room)
  cancelPrepare(room)
  cancelPendingPlayback(room)

  const now = Date.now()
  const deadlineAt = now + TIMING.READY_GATE_TIMEOUT_MS
  room.currentTrack = resolved
  room.playState = { isPlaying: false, currentTime: 0, serverTimestamp: now, revision }
  const prepare: PendingPrepare = {
    track: resolved,
    revision,
    startAt: 0,
    pendingSockets: new Set(socketIds),
    readyCount: 0,
    failedCount: 0,
    deadlineAt,
    generation,
    timer: setTimeout(() => releasePreparedPlayback(io, roomId, room, prepare), TIMING.READY_GATE_TIMEOUT_MS),
  }
  room.pendingPrepare = prepare
  io.to(roomId).emit(EVENTS.PLAYER_PREPARE, { track: resolved, revision, deadlineAt })
  broadcastRoomList(io)
  return true
}

function releasePreparedPlayback(io: TypedServer, roomId: string, room: RoomData, prepare: PendingPrepare): void {
  if (room.pendingPrepare !== prepare) return
  cancelPrepare(room)
  if (roomRepo.get(roomId) !== room || controlGenerations.get(roomId) !== prepare.generation) return
  if (!room.queue.some((item) => item.id === prepare.track.id)) return
  if (prepare.pendingSockets.size === 0 && prepare.readyCount === 0 && prepare.failedCount > 0) {
    void playNextTrackInRoom(io, roomId, room.playMode, {
      expectedTrackId: prepare.track.id,
      expectedRevision: prepare.revision,
      skipDebounce: true,
      prepareFailed: true,
    })
    return
  }
  if (hasExpiredUrl(prepare.track)) {
    void refreshPlayback(io, roomId, room, prepare.generation, prepare.startAt, true)
    return
  }
  scheduleTrackStart(io, roomId, room, prepare.track, prepare.startAt)
}

export function markClientReady(
  io: TypedServer,
  roomId: string,
  socketId: string,
  trackId: string,
  revision: number,
  failed = false,
): void {
  const room = roomRepo.get(roomId)
  if (!room) return
  const prepare = room.pendingPrepare
  if (prepare?.track.id !== trackId || prepare.revision !== revision) return
  removePrepareSocket(io, roomId, room, prepare, socketId, failed)
}

export function handleSocketLeftRoom(io: TypedServer, roomId: string, socketId: string): void {
  const room = roomRepo.get(roomId)
  if (room?.pendingPrepare) removePrepareSocket(io, roomId, room, room.pendingPrepare, socketId)
}

function removePrepareSocket(
  io: TypedServer,
  roomId: string,
  room: RoomData,
  prepare: PendingPrepare,
  socketId: string,
  failed?: boolean,
): void {
  if (!prepare.pendingSockets.delete(socketId)) return
  if (failed === true) prepare.failedCount++
  if (failed === false) prepare.readyCount++
  if (prepare.pendingSockets.size === 0) {
    releasePreparedPlayback(io, roomId, room, prepare)
  }
}

function scheduleTrackStart(io: TypedServer, roomId: string, room: RoomData, resolved: Track, startAt = 0): void {
  const scheduleTime = getScheduleTime(roomId)
  const playState = scheduled(
    {
      isPlaying: true,
      currentTime: startAt,
      serverTimestamp: scheduleTime,
      revision: getNextRevision(room),
    },
    roomId,
    scheduleTime,
  )
  schedulePlaybackCommit(io, room, 'play', resolved, playState)

  io.to(roomId).emit(EVENTS.PLAYER_PLAY, {
    track: resolved,
    playState,
  })

  // 通知大厅用户当前播放曲目变化
  broadcastRoomList(io)

  logger.info(`Playing: ${resolved.title} in room ${roomId}`, { roomId })
  void preloadUpcoming(io, roomId)
}

function restorePlaybackAfterFailedSwitch(
  io: TypedServer,
  room: RoomData,
  generation: number,
  prepare?: PrepareSnapshot,
): void {
  if (roomRepo.get(room.id) !== room || controlGenerations.get(room.id) !== generation) return
  interruptedPrepares.delete(room)
  if (prepare?.track.streamUrl && room.queue.some((item) => item.id === prepare.track.id)) {
    if (hasExpiredUrl(prepare.track)) {
      void refreshPlayback(io, room.id, room, generation, prepare.startAt, true)
    } else {
      scheduleTrackStart(io, room.id, room, prepare.track, prepare.startAt)
    }
    return
  }
  restoreEndOfTrack(io, room, generation)
}

// ---------------------------------------------------------------------------
// Preloading the next track
// ---------------------------------------------------------------------------

/**
 * What each room was last told to preload: repeated queue edits do not repeat the announcement, and a member who
 * joins mid-track (and so missed it) is told when it syncs.
 */
const announcedPreloads = new Map<string, { key: string; track: Track }>()
const plannedShuffleNext = new Map<string, { afterTrackId: string; nextTrackId: string }>()

function getPlannedShuffleNext(room: RoomData, currentId: string): Track | undefined {
  const plan = plannedShuffleNext.get(room.id)
  if (!plan) return
  const next = room.queue.find((item) => item.id === plan.nextTrackId)
  if (plan.afterTrackId === currentId && next && next.id !== currentId) return next
  plannedShuffleNext.delete(room.id)
}

/**
 * Resolve the stream URL of the track that will most likely follow the current one and announce it, so clients can
 * fetch it while the current track plays. A member whose client has to download the whole file first (the mini-app)
 * would otherwise start several seconds into every new track.
 *
 * Shuffle chooses its successor here. Loop-one reuses the current buffer.
 * The resolved URL is kept on the queue item, which makes the real transition skip
 * the provider round trip. A failure here is silent: the normal play path still resolves, falls back and reports.
 */
export async function preloadUpcoming(io: TypedServer, roomId: string): Promise<void> {
  const room = roomRepo.get(roomId)
  if (!room) {
    announcedPreloads.delete(roomId)
    plannedShuffleNext.delete(roomId)
    return
  }
  const current = getLatestPlayback(room).track
  const mode = effectivePlayMode(room.queueMode, room.playMode)
  if (mode !== 'shuffle' || !current) plannedShuffleNext.delete(roomId)
  if (!current || mode === 'loop-one') {
    announcedPreloads.delete(roomId)
    return
  }
  const planned = mode === 'shuffle' ? getPlannedShuffleNext(room, current.id) : undefined
  const next = planned ?? queueService.getNextTrack(roomId, room.playMode, current.id)
  if (!next || next.id === current.id) {
    announcedPreloads.delete(roomId)
    return
  }
  if (mode === 'shuffle') plannedShuffleNext.set(roomId, { afterTrackId: current.id, nextTrackId: next.id })
  const key = `${next.id}:${next.urlId}:${room.audioQuality}`
  if (announcedPreloads.get(roomId)?.key === key && next.streamUrl && !hasExpiredUrl(next)) return
  announcedPreloads.delete(roomId)

  const quality = room.audioQuality
  try {
    // Always resolve afresh: a URL left on the item may belong to another audio quality.
    const fresh = await refreshTrackUrl(roomId, room, next)
    // Anything may have changed while the provider answered (including the audio quality the URL was resolved for).
    if (!fresh || roomRepo.get(roomId) !== room || room.audioQuality !== quality ||
      getLatestPlayback(room).track !== current || effectivePlayMode(room.queueMode, room.playMode) !== mode) {
      return
    }
    const item = mode === 'shuffle'
      ? getPlannedShuffleNext(room, current.id)
      : queueService.getNextTrack(roomId, room.playMode, current.id)
    if (!item || item.id !== next.id || item.urlId !== next.urlId) return
    if (announcedPreloads.get(roomId)?.key === key && item.streamUrl && !hasExpiredUrl(item)) return
    item.streamUrl = fresh.streamUrl
    announcedPreloads.set(roomId, { key, track: item })
    io.to(roomId).emit(EVENTS.PLAYER_PRELOAD, { track: item })
  } catch (error) {
    logger.warn('Preload of the next track failed', { roomId, reason: error instanceof Error ? error.name : 'unknown' })
  }
}

export function resumeTrack(io: TypedServer, roomId: string, _initiatorSocket?: TypedSocket): void {
  const room = roomRepo.get(roomId)
  if (!room || room.pendingPrepare) return
  const latest = getLatestPlayback(room)
  if (!latest.track) return
  if (latest.playState.isPlaying) return
  const generation = beginControl(roomId, room)
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
  schedulePlaybackCommit(io, room, 'resume', latest.track, playState)
  io.to(roomId).emit(EVENTS.PLAYER_RESUME, { playState })
}

export function pauseTrack(io: TypedServer, roomId: string, _initiatorSocket?: TypedSocket): void {
  const room = roomRepo.get(roomId)
  if (!room) return

  const latest = getLatestPlayback(room)
  if (!latest.track) return
  beginControl(roomId, room)
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
  schedulePlaybackCommit(io, room, 'pause', latest.track, playState)
  io.to(roomId).emit(EVENTS.PLAYER_PAUSE, { playState })
}

export function seekTrack(io: TypedServer, roomId: string, currentTime: number, _initiatorSocket?: TypedSocket): void {
  if (!Number.isFinite(currentTime) || currentTime < 0) return
  const room = roomRepo.get(roomId)
  if (!room) return

  const latest = getLatestPlayback(room)
  if (!latest.track) return
  // Duration metadata can be missing (0) for some sources; retain finite,
  // non-negative validation without imposing an arbitrary upper bound.
  const seekCap = latest.track.duration > 0 ? latest.track.duration : Number.POSITIVE_INFINITY
  const clampedTime = Math.min(currentTime, seekCap)
  if (room.pendingPrepare) {
    room.pendingPrepare.startAt = clampedTime
    room.playState.currentTime = clampedTime
    return
  }
  const generation = beginControl(roomId, room)
  if (hasExpiredUrl(latest.track)) {
    void refreshPlayback(io, roomId, room, generation, clampedTime)
    return
  }
  const scheduleTime = getScheduleTime(roomId)
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
  schedulePlaybackCommit(io, room, 'seek', latest.track, playState)
  io.to(roomId).emit(EVENTS.PLAYER_SEEK, { playState })
}

export function setCurrentTrack(roomId: string, track: Track | null): void {
  const room = roomRepo.get(roomId)
  if (room) {
    beginControl(roomId, room)
    const revision = getNextRevision(room)
    cancelPendingPlayback(room)
    plannedShuffleNext.delete(roomId)
    announcedPreloads.delete(roomId)
    room.currentTrack = track
    room.playState = {
      isPlaying: track !== null,
      currentTime: 0,
      serverTimestamp: Date.now(),
      revision,
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
  beginControl(roomId, room)
  plannedShuffleNext.delete(roomId)
  announcedPreloads.delete(roomId)

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
  schedulePlaybackCommit(io, room, 'stop', null, playState, () => {
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
  const generation = beginControl(roomId, room)
  return withPlayMutex(roomId, async () => {
    if (roomRepo.get(roomId) === room && controlGenerations.get(roomId) === generation) stopPlayback(io, roomId)
  })
}

// ---------------------------------------------------------------------------
// Next / Previous track (debounce + queue navigation inside mutex)
// ---------------------------------------------------------------------------

/**
 * Manual skips supersede in-flight controls immediately. Automatic skips wait
 * for the mutex and recheck the playback they were reported against.
 */
export function playNextTrackInRoom(
  io: TypedServer,
  roomId: string,
  playMode: PlayMode,
  options?: { skipDebounce?: boolean; expectedTrackId?: string; expectedRevision?: number; prepareFailed?: boolean },
): Promise<void> {
  const room = roomRepo.get(roomId)
  if (!room) return Promise.resolve()
  const prepareFailed = options?.prepareFailed ?? false
  const expectedRevision = options?.expectedRevision
  const matchesExpectedPlayback = () =>
    (options?.expectedTrackId === undefined || getLatestPlayback(room).track?.id === options.expectedTrackId) &&
    (expectedRevision === undefined || (
      !room.pendingPrepare && !room.pendingPlayback &&
      room.playState.isPlaying !== prepareFailed && room.playState.revision === expectedRevision
    ))
  if (!matchesExpectedPlayback()) return Promise.resolve()
  if (!options?.skipDebounce && _isSkipDebounced(roomId, 'next')) return Promise.resolve()
  const manual = expectedRevision === undefined ? beginTrackSwitch(roomId, room) : undefined
  const acceptedGeneration = controlGenerations.get(roomId)
  return withPlayMutex(roomId, async () => {
    if (roomRepo.get(roomId) !== room || controlGenerations.get(roomId) !== acceptedGeneration || !matchesExpectedPlayback()) return
    const generation = manual?.generation ?? beginControl(roomId, room)
    const prepare = manual?.prepare
    const valid = () => roomRepo.get(roomId) === room && controlGenerations.get(roomId) === generation
    lastSkipTimestamp.set(roomId, { action: 'next', timestamp: Date.now() })
    const consume = room.queueMode === 'consume'
    // What is (about to be) playing is the track being left.
    const leaving = getLatestPlayback(room).track
    const nextMode = prepareFailed && playMode === 'loop-one' ? 'sequential' : playMode
    const mode = effectivePlayMode(room.queueMode, nextMode)
    const planned = mode === 'shuffle' && leaving ? getPlannedShuffleNext(room, leaving.id) : undefined
    plannedShuffleNext.delete(roomId)
    let nextTrack = planned ?? queueService.getNextTrack(roomId, nextMode, leaving?.id)
    if ((consume || prepareFailed) && nextTrack?.id === leaving?.id) nextTrack = null

    if (consume && leaving) {
      // A queue that is consumed as it plays: the one just heard (or skipped) is done with and leaves it for good, so
      // nothing comes round again and what others queued is next in line.
      queueService.removeTrack(roomId, leaving.id)
      io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room.queue })
    }

    if (!nextTrack) {
      stopPlayback(io, roomId)
      return
    }

    const success = await _playTrackInRoom(io, roomId, nextTrack, generation)
    if (!valid()) return
    if (!success) {
      // Past the one that failed (the track left behind is no longer in a consumed queue to count from).
      const skipTrack = queueService.getNextTrack(roomId, nextMode, consume ? nextTrack.id : undefined)
      const skipped = skipTrack && skipTrack.id !== prepare?.track.id && !(prepareFailed && skipTrack.id === leaving?.id)
        ? await _playTrackInRoom(io, roomId, skipTrack, generation)
        : false
      if (!valid()) return
      if (!skipped) {
        if (consume || prepareFailed) stopPlayback(io, roomId)
        else restorePlaybackAfterFailedSwitch(io, room, generation, prepare)
      }
    }

    // Keep duplicate controls debounced immediately after URL resolution too.
    lastSkipTimestamp.set(roomId, { action: 'next', timestamp: Date.now() })
    restoreEndOfTrack(io, room, generation)
  })
}

/**
 * Go to the previous track in the queue. Same mutex serialization as next.
 */
export function playPrevTrackInRoom(
  io: TypedServer,
  roomId: string,
  options?: { skipDebounce?: boolean; expectedTrackId?: string },
): Promise<void> {
  const room = roomRepo.get(roomId)
  if (!room) return Promise.resolve()
  if (options?.expectedTrackId !== undefined && getLatestPlayback(room).track?.id !== options.expectedTrackId) return Promise.resolve()
  const activePrepare = room.pendingPrepare
  const hasNoPreparedPredecessor = activePrepare && !queueService.getPreviousTrack(roomId, activePrepare.track.id)
  // A previous command with no destination must not abort preparation.
  if (hasNoPreparedPredecessor && room.queueMode !== 'consume') return Promise.resolve()
  if (!options?.skipDebounce && _isSkipDebounced(roomId, 'prev')) return Promise.resolve()
  lastSkipTimestamp.set(roomId, { action: 'prev', timestamp: Date.now() })
  if (hasNoPreparedPredecessor) {
    seekTrack(io, roomId, 0)
    return Promise.resolve()
  }
  const { prepare, generation } = beginTrackSwitch(roomId, room)
  const valid = () => roomRepo.get(roomId) === room && controlGenerations.get(roomId) === generation
  return withPlayMutex(roomId, async () => {
    if (!valid()) return
    // Step back from what is (about to be) playing, which is not `room.currentTrack` while a switch is still pending.
    const leavingId = getLatestPlayback(room).track?.id
    if (options?.expectedTrackId !== undefined && leavingId !== options.expectedTrackId) return
    const prevTrack = queueService.getPreviousTrack(roomId, leavingId)
    if (!prevTrack) {
      // In a consumed queue what was heard has left it, so there is nothing to go back to: "previous" starts the
      // current track over instead of doing nothing.
      if (room.queueMode === 'consume' && leavingId && !prepare) seekTrack(io, roomId, 0)
      restorePlaybackAfterFailedSwitch(io, room, generation, prepare && {
        track: prepare.track,
        startAt: room.queueMode === 'consume' ? 0 : prepare.startAt,
      })
      return
    }

    const success = await _playTrackInRoom(io, roomId, prevTrack, generation)
    if (!valid()) return
    if (!success) {
      const skipTrack = queueService.getPreviousTrack(roomId, leavingId)
      const skipped = skipTrack && skipTrack.id !== prepare?.track.id
        ? await _playTrackInRoom(io, roomId, skipTrack, generation)
        : false
      if (!valid()) return
      if (!skipped) restorePlaybackAfterFailedSwitch(io, room, generation, prepare)
    }

    // Refresh debounce timestamp after async work (same rationale as playNextTrackInRoom)
    lastSkipTimestamp.set(roomId, { action: 'prev', timestamp: Date.now() })
    restoreEndOfTrack(io, room, generation)
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
  const prepare = room.pendingPrepare
  if (prepare) {
    const { track, revision, deadlineAt } = prepare
    socket.emit(EVENTS.PLAYER_PREPARE, { track, revision, deadlineAt })
    return
  }
  await syncCurrentPlayback(io, socket, roomId, room)
  // Someone who joins mid-track missed the announcement of the next one: without it their client would still
  // start the next track cold, seconds behind everybody else.
  const upcoming = announcedPreloads.get(roomId)
  if (upcoming && room.queue.includes(upcoming.track) && !hasExpiredUrl(upcoming.track) &&
    roomRepo.getSocketMapping(socket.id)?.roomId === roomId) {
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
// Room cleanup and debounce
// ---------------------------------------------------------------------------

/** Debounce repeated skip actions without blocking an immediate direction reversal. */
const lastSkipTimestamp = new Map<string, { action: 'next' | 'prev'; timestamp: number }>()

/** Remove per-room entries for a deleted room */
export function cleanupRoom(roomId: string): void {
  cleanupPlayerRoom(roomId)
  fallbackCooldown.clearRoom(roomId)
}

function cleanupPlayerRoom(roomId: string): void {
  lastSkipTimestamp.delete(roomId)
  playMutexes.delete(roomId)
  controlGenerations.delete(roomId)
  announcedPreloads.delete(roomId)
  plannedShuffleNext.delete(roomId)
  cancelEndOfTrack(roomId)
  const room = roomRepo.get(roomId)
  if (room) {
    interruptedPrepares.delete(room)
    cancelPrepare(room)
    cancelPendingPlayback(room)
  }
}

registerRoomCleanup('player', cleanupPlayerRoom)

/** Debounce only duplicate NEXT or duplicate PREV actions for a room. */
function _isSkipDebounced(roomId: string, action: 'next' | 'prev'): boolean {
  const now = Date.now()
  const last = lastSkipTimestamp.get(roomId)
  if (last?.action === action && now - last.timestamp < config.player.nextDebounceMs) return true
  lastSkipTimestamp.set(roomId, { action, timestamp: now })
  return false
}
