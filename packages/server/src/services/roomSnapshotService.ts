import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomUUID } from 'node:crypto'
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { open, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { LIMITS, MUSIC_SOURCES } from '@music-together/shared'
import { z } from 'zod/v4'
import { config } from '../config.js'
import type { TypedServer } from '../middleware/types.js'
import { chatRepo } from '../repositories/chatRepository.js'
import { roomRepo } from '../repositories/roomRepository.js'
import type { RoomData } from '../repositories/types.js'
import { logger } from '../utils/logger.js'
import { getLatestPlayback, getUpcomingTrackForSnapshot } from './playerService.js'
import { scheduleDeletion } from './roomLifecycleService.js'

const format = 'mt-room-snapshot'
const envelopeSchema = z.strictObject({
  format: z.literal(format),
  v: z.literal(1),
  iv: z.base64(),
  tag: z.base64(),
  ct: z.base64(),
})

const timestamp = z.number().int().nonnegative()
const MAX_SAVED_AT_SKEW_MS = 60_000
// Provider metadata can enter the room without going through the client input limits.
const snapshotTrackId = z.string().max(1_024)
const snapshotTrackText = z.string().max(4_096)
const snapshotTrackUrl = z.string().max(16_384)
const snapshotTrackSchema = z.object({
  id: snapshotTrackId.min(1),
  title: snapshotTrackText,
  artist: z.array(snapshotTrackText).max(200),
  artistIds: z.array(snapshotTrackId).max(200).optional(),
  album: snapshotTrackText,
  duration: z.number().finite().nonnegative(),
  cover: snapshotTrackUrl,
  thumbnailCover: snapshotTrackUrl.optional(),
  source: z.enum(MUSIC_SOURCES),
  sourceId: snapshotTrackId,
  urlId: snapshotTrackId,
  lyricId: snapshotTrackId.optional(),
  picId: snapshotTrackId.optional(),
  streamUrl: snapshotTrackUrl.optional(),
  vip: z.boolean().optional(),
  requestedBy: z.string().max(500).optional(),
})
const memberSchema = z.strictObject({ userId: z.string().min(1), nickname: z.string() })
const roomSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  creatorId: z.string().min(1),
  adminUserIds: z.array(z.string().min(1)),
  audioQuality: z.union([z.literal(128), z.literal(192), z.literal(320), z.literal(999)]),
  playMode: z.enum(['sequential', 'loop-all', 'loop-one', 'shuffle']),
  queueMode: z.enum(['keep', 'consume']),
  password: z.string().nullable(),
  queue: z.array(snapshotTrackSchema.strict()),
  currentTrack: snapshotTrackSchema.strict().nullable(),
  playState: z.strictObject({
    isPlaying: z.boolean(),
    currentTime: z.number().nonnegative(),
    serverTimestamp: timestamp,
    revision: z.number().int().nonnegative(),
  }),
  members: z.array(memberSchema),
  departed: z.array(memberSchema.extend({ departedAt: timestamp })),
  chat: z.array(z.strictObject({
    id: z.string(),
    userId: z.string(),
    nickname: z.string(),
    content: z.string(),
    timestamp,
    type: z.enum(['user', 'system']),
  })).max(LIMITS.CHAT_HISTORY_MAX),
  emptySince: timestamp.nullable(),
})
const snapshotSchema = z.strictObject({
  buildId: z.string().min(1),
  savedAt: timestamp,
  reason: z.enum(['shutdown', 'periodic']),
  rooms: z.array(roomSchema),
})

type Snapshot = z.infer<typeof snapshotSchema>
type SnapshotRoom = z.infer<typeof roomSchema>
type Storage = { file: string; key: Buffer }
let storage: Storage | undefined
let scheduler: ReturnType<typeof setInterval> | undefined
let periodicWrite: Promise<void> | undefined
let writeGeneration = 0
let lastSignature: string | undefined

function initializeStorage(): Storage | undefined {
  if (!config.roomSnapshot.enabled) {
    logger.info('Room snapshots disabled by configuration')
    return
  }
  if (!config.stateDir || !config.identity.hasPersistentSecret) {
    logger.info('Room snapshots disabled (requires STATE_DIR and a persistent IDENTITY_SECRET)')
    return
  }
  const probe = join(config.stateDir, `.room-snapshot-probe-${randomUUID()}`)
  try {
    mkdirSync(config.stateDir, { recursive: true })
    writeFileSync(probe, '', { flag: 'wx', mode: 0o600 })
    rmSync(probe)
    return {
      file: join(config.stateDir, 'room-snapshot.v1.bin'),
      key: Buffer.from(hkdfSync('sha256', config.identity.secret, format, 'v1', 32)),
    }
  } catch {
    logger.warn('Room snapshots disabled (STATE_DIR is unavailable)')
  }
}

function captureRoom(room: RoomData, now: number): SnapshotRoom {
  const { track, playState } = getLatestPlayback(room)
  const prepare = room.pendingPrepare
  const currentTrack = track === null ? null : snapshotTrackSchema.safeParse(track).data ?? null
  const queue: SnapshotRoom['queue'] = []
  for (const item of room.queue) {
    const parsed = snapshotTrackSchema.safeParse(item)
    if (parsed.success) queue.push(parsed.data)
  }
  const skippedQueueTracks = room.queue.length - queue.length
  const skippedCurrentTrack = track !== null && currentTrack === null
  if (skippedQueueTracks || skippedCurrentTrack) {
    logger.warn('Invalid tracks skipped during room snapshot capture', {
      roomId: room.id, skippedQueueTracks, skippedCurrentTrack,
    })
  }
  const next = getUpcomingTrackForSnapshot({ ...room, queue }, currentTrack)
  for (const item of queue) {
    if (item.id !== currentTrack?.id && item.id !== next?.id) delete item.streamUrl
  }
  const departed: SnapshotRoom['departed'] = []
  for (const [userId, entry] of room.returningMembers ?? []) {
    if (entry.expiresAt <= now) room.returningMembers?.delete(userId)
    else departed.push({ userId, nickname: entry.nickname, departedAt: entry.departedAt })
  }
  return {
    id: room.id,
    name: room.name,
    creatorId: room.creatorId,
    adminUserIds: [...room.adminUserIds],
    audioQuality: room.audioQuality,
    playMode: room.playMode,
    queueMode: room.queueMode,
    password: room.password,
    queue,
    currentTrack,
    playState: prepare && currentTrack
      ? { isPlaying: true, currentTime: prepare.startAt, serverTimestamp: prepare.deadlineAt, revision: prepare.revision + 1 }
      : {
          isPlaying: currentTrack !== null && playState.isPlaying,
          currentTime: playState.currentTime,
          serverTimestamp: playState.serverTimestamp,
          revision: playState.revision,
        },
    members: room.users.map(({ id, nickname }) => ({ userId: id, nickname })),
    departed,
    chat: chatRepo.getHistory(room.id).slice(-LIMITS.CHAT_HISTORY_MAX),
    emptySince: room.emptySince ?? null,
  }
}

function captureRooms(now: number): SnapshotRoom[] {
  const rooms: SnapshotRoom[] = []
  for (const [roomId, room] of roomRepo.getAll()) {
    try {
      rooms.push(roomSchema.parse(captureRoom(room, now)))
    } catch {
      logger.warn('Invalid room skipped during room snapshot capture', { roomId })
    }
  }
  return rooms
}

function encrypt(snapshot: Snapshot, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(snapshot)), cipher.final()])
  return JSON.stringify({
    format,
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ct: ct.toString('base64'),
  })
}

function decrypt(contents: string, key: Buffer): Snapshot {
  const envelope = envelopeSchema.parse(JSON.parse(contents))
  const iv = Buffer.from(envelope.iv, 'base64')
  if (iv.length !== 12) throw new Error('Invalid snapshot IV')
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ct, 'base64')), decipher.final()])
  return snapshotSchema.parse(JSON.parse(plaintext.toString('utf8')))
}

export function saveSnapshotSync(reason: Snapshot['reason']): void {
  if (!storage) return
  ++writeGeneration
  const { file, key } = storage
  const temp = `${file}.tmp`
  try {
    const savedAt = Date.now()
    const contents = encrypt({ buildId: config.buildId, savedAt, reason, rooms: captureRooms(savedAt) }, key)
    rmSync(temp, { force: true })
    const fd = openSync(temp, 'wx', 0o600)
    try {
      writeFileSync(fd, contents)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(temp, file)
  } catch {
    logger.warn('Could not save room snapshot')
  }
}

async function savePeriodicSnapshot({ file, key }: Storage): Promise<void> {
  const temp = `${file}.periodic.tmp`
  const generation = writeGeneration
  try {
    const savedAt = Date.now()
    const rooms = captureRooms(savedAt)
    const signature = createHash('sha256').update(JSON.stringify(rooms)).digest('hex')
    if (signature === lastSignature) return
    const contents = encrypt({ buildId: config.buildId, savedAt, reason: 'periodic', rooms }, key)
    await rm(temp, { force: true })
    const fd = await open(temp, 'wx', 0o600)
    try {
      await fd.writeFile(contents)
      await fd.sync()
    } finally {
      await fd.close()
    }
    // Check and rename in the same turn so a shutdown write always wins.
    if (generation === writeGeneration) {
      renameSync(temp, file)
      lastSignature = signature
    } else {
      await rm(temp, { force: true })
    }
  } catch {
    logger.warn('Could not save periodic room snapshot')
  }
}

export function startSnapshotScheduler(): void {
  if (!storage || scheduler) return
  const target = storage
  scheduler = setInterval(() => {
    if (periodicWrite) return
    periodicWrite = savePeriodicSnapshot(target).finally(() => { periodicWrite = undefined })
  }, config.roomSnapshot.intervalMs)
  scheduler.unref()
}

export function stopSnapshotScheduler(): Promise<void> | undefined {
  if (scheduler) clearInterval(scheduler)
  scheduler = undefined
  return periodicWrite
}

function restoreRoom(io: TypedServer, saved: SnapshotRoom, savedAt: number, now: number): void {
  const { members, departed, chat, adminUserIds, ...state } = saved
  const playState = state.playState
  if (playState.isPlaying && Math.max(0, now - savedAt) > config.roomSnapshot.continuityMs) {
    const duration = state.currentTrack?.duration
    playState.isPlaying = false
    playState.currentTime = Math.min(
      playState.currentTime + Math.max(0, savedAt - playState.serverTimestamp) / 1000,
      duration && duration > 0 ? duration : Infinity,
    )
    playState.serverTimestamp = now
  }

  const returningMembers: NonNullable<RoomData['returningMembers']> = new Map()
  const expiresAt = now + config.roomSnapshot.rejoinWindowMs
  for (const { userId, nickname, departedAt } of departed) {
    returningMembers.set(userId, { nickname, expiresAt, departedAt })
  }
  for (const { userId, nickname } of members) {
    returningMembers.set(userId, { nickname, expiresAt, departedAt: savedAt })
  }
  roomRepo.set(state.id, {
    ...state,
    hostId: state.creatorId,
    conductorSocketId: null,
    adminUserIds: new Set(adminUserIds),
    temporaryAdminUserId: null,
    users: [],
    pendingPrepare: null,
    pendingPlayback: null,
    returningMembers,
    awaitingFirstJoin: true,
    emptySince: state.emptySince ?? now,
  })
  chatRepo.createRoom(state.id)
  for (const message of chat) chatRepo.addMessage(state.id, message)
  scheduleDeletion(state.id, io, config.roomSnapshot.rejoinWindowMs)
}

export function restoreRoomsFromSnapshot(io: TypedServer): void {
  storage = initializeStorage()
  lastSignature = undefined
  if (!storage) return
  const { file, key } = storage
  let contents: string
  try {
    contents = readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') logger.warn('Could not read room snapshot')
    return
  }

  const now = Date.now()
  let snapshot: Snapshot
  try {
    snapshot = decrypt(contents, key)
    if (now - snapshot.savedAt > config.roomSnapshot.maxAgeMs) throw new Error('Snapshot expired')
    if (snapshot.savedAt > now + MAX_SAVED_AT_SKEW_MS) throw new Error('Snapshot timestamp is too far in the future')
  } catch {
    try {
      renameSync(file, `${file}.rejected`)
    } catch {
      logger.warn('Could not quarantine rejected room snapshot')
    }
    logger.warn('Room snapshot rejected (expired, invalid, or encrypted with a different identity secret)')
    return
  }

  for (const room of snapshot.rooms) restoreRoom(io, room, snapshot.savedAt, now)
  logger.info('Room snapshot restored', { rooms: snapshot.rooms.length })
}
