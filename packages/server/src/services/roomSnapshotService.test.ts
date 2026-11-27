import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EVENTS, LIMITS, type Track } from '@music-together/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../config.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { chatRepo } from '../repositories/chatRepository.js'
import { logger } from '../utils/logger.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { addCookie, cleanupRoom as cleanupAuthRoom, getAnyCookie } from './authService.js'
import { musicProvider } from './musicProvider.js'
import { cleanupRoom, notifyRestoredPlaybackCookie, pauseTrack, syncPlaybackToSocket } from './playerService.js'
import { cleanupRoomRejoinTickets, consumeRejoinTicket, issueRejoinTicket } from './rejoinTicketService.js'
import { clearAllTimers } from './roomLifecycleService.js'
import { createRoom, joinRoom, leaveRoom, setUserRole, validateJoinRequest } from './roomService.js'
import {
  restoreRoomsFromSnapshot,
  saveSnapshotSync,
  startSnapshotScheduler,
  stopSnapshotScheduler,
} from './roomSnapshotService.js'
import { estimateCurrentTime } from './syncService.js'

vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

const secret = 'fixture-snapshot-secret-with-32-characters'
const now = Date.parse('2026-02-01T00:00:00Z')
const originalConfig = { stateDir: config.stateDir, identity: config.identity, roomSnapshot: config.roomSnapshot }
const emit = vi.fn()
const io = { to: () => ({ emit }), emit } as unknown as TypedServer
let directory: string
let file: string

function track(id: string, streamUrl = `https://example.com/${id}.mp3`): Track {
  return { id, title: id, artist: [], album: '', duration: 180, cover: '', source: 'netease', sourceId: id, urlId: id, streamUrl }
}

function fixture() {
  const { room } = createRoom('owner-socket', 'Owner', 'Listening Room', 'room-password', 'owner')
  room.queue = [track('playing'), track('next'), track('later')]
  room.currentTrack = room.queue[0]
  room.playState = { isPlaying: true, currentTime: 10, serverTimestamp: now - 5_000, revision: 3 }
  return room
}

function clearRooms() {
  clearAllTimers()
  for (const id of roomRepo.getAllIds()) {
    cleanupRoom(id)
    cleanupAuthRoom(id)
    cleanupRoomRejoinTickets(id)
    for (const socketId of roomRepo.getRoomSocketIds(id)) roomRepo.deleteSocketMapping(socketId)
    roomRepo.delete(id)
    chatRepo.deleteRoom(id)
  }
}

function restartAfter(gap: number) {
  saveSnapshotSync('shutdown')
  clearRooms()
  vi.setSystemTime(Date.now() + gap)
  restoreRoomsFromSnapshot(io)
}

function decryptSnapshot() {
  const { iv, tag, ct } = JSON.parse(readFileSync(file, 'utf8'))
  const key = Buffer.from(hkdfSync('sha256', secret, 'mt-room-snapshot', 'v1', 32))
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8'))
}

function rejoin(roomId: string) {
  const socket = { id: 'returning-socket', emit: vi.fn() }
  const result = joinRoom(socket.id, roomId, 'Owner', 'owner')!
  return { socket, synced: syncPlaybackToSocket(io, socket as unknown as TypedSocket, roomId, result.room) }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.clearAllMocks()
  directory = mkdtempSync(join(tmpdir(), 'mt-room-snapshot-'))
  file = join(directory, 'room-snapshot.v1.bin')
  Object.assign(config, {
    stateDir: directory,
    identity: { ...config.identity, secret, hasPersistentSecret: true },
    roomSnapshot: { enabled: true, continuityMs: 120_000, rejoinWindowMs: 120_000, maxAgeMs: 600_000, intervalMs: 15_000 },
  })
  restoreRoomsFromSnapshot(io)
})

afterEach(async () => {
  await stopSnapshotScheduler()
  clearRooms()
  rmSync(directory, { recursive: true, force: true })
  Object.assign(config, originalConfig)
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('room snapshot persistence', () => {
  it('captures a room with a pending schedule calculated from a fractional RTT', () => {
    const room = fixture()
    vi.spyOn(roomRepo, 'getP90RTT').mockReturnValue(187.3)
    pauseTrack(io, room.id)

    saveSnapshotSync('shutdown')

    expect(decryptSnapshot().rooms).toEqual([expect.objectContaining({
      id: room.id, playState: expect.objectContaining({ serverTimestamp: now + 381 }),
    })])
  })

  it('logs only paths and codes for invalid room fields', () => {
    const room = fixture()
    Object.assign(room.playState, { serverTimestamp: 'sensitive-invalid-timestamp' })

    saveSnapshotSync('shutdown')

    expect(logger.warn).toHaveBeenCalledWith('Invalid room skipped during room snapshot capture', {
      roomId: room.id,
      issues: [{ path: ['playState', 'serverTimestamp'], code: 'invalid_type' }],
    })
  })

  it('encrypts room state, keeps only useful stream URLs, and excludes runtime credentials', () => {
    const room = fixture()
    joinRoom('admin-socket', room.id, 'Admin', 'admin')
    setUserRole(room.id, 'admin', 'admin')
    joinRoom('guest-socket', room.id, 'Guest', 'guest')
    leaveRoom('guest-socket')
    const expired = { nickname: 'Expired', departedAt: now - 60_000, expiresAt: now }
    room.returningMembers!.set('expired', expired)
    const { token } = issueRejoinTicket(room.id, 'owner')
    addCookie(room.id, 'netease', 'owner', 'music-cookie-value', 'Owner', 11)
    for (let index = 0; index <= LIMITS.CHAT_HISTORY_MAX; index++) {
      chatRepo.addMessage(room.id, {
        id: String(index), userId: 'owner', nickname: 'Owner', content: 'Message', timestamp: now, type: 'user',
      })
    }
    saveSnapshotSync('shutdown')
    const contents = readFileSync(file, 'utf8')
    expect(JSON.parse(contents)).toEqual({
      format: 'mt-room-snapshot', v: 1, iv: expect.any(String), tag: expect.any(String), ct: expect.any(String),
    })
    expect(contents).not.toContain('room-password')
    const saved = decryptSnapshot()
    expect(saved).toMatchObject({ reason: 'shutdown', buildId: config.buildId, savedAt: now })
    const [persisted] = saved.rooms
    expect(persisted.departed).toEqual([{ userId: 'guest', nickname: 'Guest', departedAt: now }])
    expect(persisted.queue.map((item: Track) => item.streamUrl)).toEqual([
      room.queue[0].streamUrl, room.queue[1].streamUrl, undefined,
    ])
    const plaintext = JSON.stringify(saved)
    for (const excluded of [token, 'music-cookie-value', 'owner-socket', 'admin-socket', 'guest-socket', 'conductorSocketId']) {
      expect(plaintext).not.toContain(excluded)
    }

    clearRooms()
    restoreRoomsFromSnapshot(io)
    expect(roomRepo.get(room.id)).toMatchObject({
      id: room.id, creatorId: 'owner', hostId: 'owner', users: [], conductorSocketId: null,
      temporaryAdminUserId: null, pendingPlayback: null, pendingPrepare: null,
      adminUserIds: new Set(['admin']), password: 'room-password',
      returningMembers: new Map([
        ['owner', { nickname: 'Owner', departedAt: now, expiresAt: now + 120_000 }],
        ['admin', { nickname: 'Admin', departedAt: now, expiresAt: now + 120_000 }],
        ['guest', { nickname: 'Guest', departedAt: now, expiresAt: now + 120_000 }],
      ]),
    })
    expect(chatRepo.getHistory(room.id)).toHaveLength(LIMITS.CHAT_HISTORY_MAX)
    expect(chatRepo.getHistory(room.id)[0].id).toBe('1')
    expect(getAnyCookie('netease', room.id)).toBeNull()
    expect(consumeRejoinTicket(token, room.id, 'owner')).toBe(false)
    expect(validateJoinRequest(room.id, 'reconnected', 'guest')).toMatchObject({ valid: true, skipPassword: true })
  })

  it('preserves who requested the current and queued tracks', () => {
    const room = fixture()
    room.queue[0].requestedBy = 'Owner'
    room.queue[1].requestedBy = 'Guest'

    restartAfter(0)

    const restored = roomRepo.get(room.id)
    expect(restored?.currentTrack?.requestedBy).toBe('Owner')
    expect(restored?.queue[0].requestedBy).toBe('Owner')
    expect(restored?.queue[1].requestedBy).toBe('Guest')
  })

  it('restores long provider metadata and skips malformed tracks without losing either room', () => {
    const room = fixture()
    const other = createRoom('other-socket', 'Other', 'Other Room', undefined, 'other').room
    const longTitle = { ...track('long-title'), title: 'x'.repeat(501) }
    const manyArtists = { ...track('many-artists'), artist: Array.from({ length: 21 }, (_, index) => `Artist ${index}`) }
    const malformed = { ...track('malformed'), duration: -1 }
    room.currentTrack = malformed
    room.queue = [malformed, null as unknown as Track, longTitle, manyArtists]
    other.queue = [track('other-track')]

    restartAfter(0)

    expect(roomRepo.get(room.id)).toMatchObject({
      currentTrack: null,
      playState: { isPlaying: false },
      queue: [longTitle, expect.objectContaining({ id: manyArtists.id, artist: manyArtists.artist })],
    })
    expect(roomRepo.get(other.id)?.queue).toEqual([other.queue[0]])
  })

  it('skips an invalid room and restores the other rooms', () => {
    const room = fixture()
    const invalid = createRoom('other-socket', 'Other', 'Other Room', undefined, 'other').room
    invalid.playState.currentTime = Number.NaN

    restartAfter(0)

    expect(roomRepo.get(room.id)?.currentTrack?.id).toBe('playing')
    expect(roomRepo.get(invalid.id)).toBeUndefined()
  })

  it.each(['wrong key', 'expired', 'future timestamp', 'invalid envelope'])('quarantines a snapshot with %s', (failure) => {
    const room = fixture()
    saveSnapshotSync('shutdown')
    clearRooms()
    if (failure === 'wrong key') {
      Object.assign(config, { identity: { ...config.identity, secret: 'another-persistent-identity-secret' } })
    } else if (failure === 'expired') {
      vi.setSystemTime(now + config.roomSnapshot.maxAgeMs + 1)
    } else if (failure === 'future timestamp') {
      vi.setSystemTime(now - 60_001)
    } else {
      writeFileSync(file, JSON.stringify({ format: 'mt-room-snapshot', v: 2 }))
    }
    restoreRoomsFromSnapshot(io)
    expect(roomRepo.get(room.id)).toBeUndefined()
    expect(existsSync(file)).toBe(false)
    expect(existsSync(`${file}.rejected`)).toBe(true)
  })

  it('rejects authenticated plaintext with fields outside the snapshot schema', () => {
    const room = fixture()
    saveSnapshotSync('shutdown')
    const payload = decryptSnapshot()
    payload.rooms[0].socketId = 'unexpected-runtime-field'
    const iv = randomBytes(12)
    const key = Buffer.from(hkdfSync('sha256', secret, 'mt-room-snapshot', 'v1', 32))
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ct = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()])
    writeFileSync(file, JSON.stringify({
      format: 'mt-room-snapshot', v: 1,
      iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ct: ct.toString('base64'),
    }))

    clearRooms()
    restoreRoomsFromSnapshot(io)
    expect(roomRepo.get(room.id)).toBeUndefined()
    expect(existsSync(`${file}.rejected`)).toBe(true)
  })

  it('skips persistence when storage is unavailable or the identity secret is temporary', () => {
    fixture()
    const invalidDirectory = join(directory, 'regular-file')
    writeFileSync(invalidDirectory, '')
    Object.assign(config, { stateDir: invalidDirectory })
    restoreRoomsFromSnapshot(io)
    expect(() => saveSnapshotSync('shutdown')).not.toThrow()
    Object.assign(config, { stateDir: directory, identity: { ...config.identity, hasPersistentSecret: false } })
    restoreRoomsFromSnapshot(io)
    saveSnapshotSync('shutdown')
    expect(existsSync(file)).toBe(false)
  })

  it('does not let a periodic write overwrite the final shutdown state', async () => {
    const room = fixture()
    startSnapshotScheduler()
    vi.advanceTimersByTime(15_000)
    room.name = 'Final room name'
    const pending = stopSnapshotScheduler()
    saveSnapshotSync('shutdown')

    await pending
    expect(existsSync(`${file}.periodic.tmp`)).toBe(false)
    expect(decryptSnapshot()).toMatchObject({ reason: 'shutdown', rooms: [{ name: 'Final room name' }] })
  })

  it('periodically records changed rooms and saves an empty snapshot after deletion', async () => {
    const room = fixture()
    startSnapshotScheduler()
    vi.advanceTimersByTime(15_000)
    await stopSnapshotScheduler()
    const firstSave = readFileSync(file, 'utf8')

    startSnapshotScheduler()
    vi.advanceTimersByTime(15_000)
    await stopSnapshotScheduler()
    expect(readFileSync(file, 'utf8')).toBe(firstSave)
    roomRepo.delete(room.id)
    startSnapshotScheduler()
    vi.advanceTimersByTime(15_000)
    await stopSnapshotScheduler()
    expect(decryptSnapshot()).toMatchObject({ reason: 'periodic', rooms: [] })
    roomRepo.deleteSocketMapping('owner-socket')
    chatRepo.deleteRoom(room.id)
  })

  it('folds pending playback and a prepare into the committed snapshot shape', () => {
    const room = fixture()
    const next = room.queue[1]
    const executeAt = now + 300
    room.pendingPlayback = {
      type: 'play', track: next,
      playState: { isPlaying: true, currentTime: 15, serverTimestamp: executeAt, serverTimeToExecute: executeAt, revision: 4 },
      timer: setTimeout(() => {}, 300),
    }
    saveSnapshotSync('shutdown')
    expect(decryptSnapshot().rooms[0]).toMatchObject({ currentTrack: next, playState: { currentTime: 15, revision: 4 } })
    expect(decryptSnapshot().rooms[0].playState).not.toHaveProperty('serverTimeToExecute')

    room.pendingPrepare = {
      track: room.queue[2], revision: 5, startAt: 20, deadlineAt: now + 1_000,
      pendingSockets: new Set(['owner-socket']), readyCount: 0, failedCount: 0, generation: 1,
      timer: setTimeout(() => {}, 1_000),
    }
    saveSnapshotSync('shutdown')
    expect(decryptSnapshot().rooms[0]).toMatchObject({
      currentTrack: room.queue[2],
      playState: { isPlaying: true, currentTime: 20, serverTimestamp: now + 1_000, revision: 6 },
    })
  })
})

describe('restored playback', () => {
  it('continues the timeline at the configured boundary, and deletes rooms that stay empty', () => {
    const room = fixture()
    restartAfter(120_000)
    expect(roomRepo.get(room.id)?.playState.serverTimestamp).toBe(now - 5_000)
    expect(estimateCurrentTime(room.id)).toBe(135)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(119_999)
    expect(roomRepo.get(room.id)).toBeDefined()
    vi.advanceTimersByTime(1)
    expect(roomRepo.get(room.id)).toBeUndefined()
    expect(emit.mock.calls.some(([event]) => event === EVENTS.PLAYER_PREPARE || event === EVENTS.PLAYER_PLAY)).toBe(false)
  })

  it('pauses at the saved position on a longer restart and stays paused on rejoin', async () => {
    const room = fixture()
    restartAfter(120_001)
    expect(roomRepo.get(room.id)?.playState).toEqual({
      isPlaying: false, currentTime: 15, serverTimestamp: now + 120_001, revision: 3,
    })
    const { socket, synced } = rejoin(room.id)
    await synced
    expect(socket.emit).toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.objectContaining({
      playState: expect.objectContaining({ isPlaying: false, currentTime: 15 }),
    }))
    expect(roomRepo.get(room.id)?.pendingPlayback).toBeNull()
  })

  it.each([false, true])('advances after the first join for an already ended track = %s', async (ended) => {
    const room = fixture()
    room.currentTrack!.duration = ended ? 10 : 20
    vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue('https://example.com/resolved.mp3')
    restartAfter(0)
    expect(roomRepo.get(room.id)?.currentTrack?.id).toBe('playing')
    await rejoin(room.id).synced
    if (!ended) {
      expect(emit).not.toHaveBeenCalledWith(EVENTS.PLAYER_PREPARE, expect.anything())
      await vi.advanceTimersByTimeAsync(10_000)
    }
    expect(emit).toHaveBeenCalledWith(EVENTS.PLAYER_PREPARE, expect.objectContaining({
      track: expect.objectContaining({ id: 'next' }),
    }))
  })

  it.each([false, true])('defers expired URL resolution until cookie arrives = %s or 2 seconds pass', async (cookieArrives) => {
    const room = fixture()
    room.currentTrack!.streamUrl = 'https://m10.music.126.net/20260101000000/signature/song.mp3'
    const url = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue('https://example.com/fresh.mp3')
    restartAfter(0)
    const { socket, synced } = rejoin(room.id)
    await vi.advanceTimersByTimeAsync(500)
    await notifyRestoredPlaybackCookie(io, room.id, 'tencent')
    expect(url).not.toHaveBeenCalled()
    if (cookieArrives) {
      addCookie(room.id, 'netease', 'owner', 'owner-vip-cookie', 'Owner', 11)
      await notifyRestoredPlaybackCookie(io, room.id, 'netease')
    } else {
      await vi.advanceTimersByTimeAsync(1_499)
      expect(url).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
    }
    await synced
    expect(url).toHaveBeenCalledExactlyOnceWith('netease', 'playing', 320, cookieArrives ? 'owner-vip-cookie' : undefined)
    expect(socket.emit).toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.objectContaining({
      track: expect.objectContaining({ streamUrl: 'https://example.com/fresh.mp3' }),
    }))
  })

  it.each(['after the failure', 'during the initial refresh', 'after a manual pause'])(
    'handles a matching cookie arriving %s', async (arrival) => {
      const room = fixture()
      room.currentTrack!.streamUrl = 'https://m10.music.126.net/20260101000000/signature/song.mp3'
      const freshUrl = 'https://example.com/fresh.mp3'
      let finishInitialRefresh!: (url: null) => void
      const initialRefresh = new Promise<null>((resolve) => { finishInitialRefresh = resolve })
      const url = vi.spyOn(musicProvider, 'getStreamUrl').mockImplementation((_source, _id, _quality, cookie) =>
        cookie ? Promise.resolve(freshUrl) : initialRefresh,
      )
      restartAfter(0)
      const { synced } = rejoin(room.id)
      await vi.advanceTimersByTimeAsync(2_000)
      expect(url).toHaveBeenCalledExactlyOnceWith('netease', 'playing', 320, undefined)

      if (arrival !== 'during the initial refresh') {
        finishInitialRefresh(null)
        await synced
      }
      if (arrival === 'after a manual pause') pauseTrack(io, room.id)
      addCookie(room.id, 'netease', 'owner', 'owner-vip-cookie', 'Owner', 11)
      await notifyRestoredPlaybackCookie(io, room.id, 'tencent')
      expect(emit).not.toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.anything())
      await notifyRestoredPlaybackCookie(io, room.id, 'netease')
      if (arrival === 'during the initial refresh') {
        // Fail the anonymous request and its bitrate fallbacks before using the cookie.
        url.mockImplementationOnce(async () => null).mockImplementationOnce(async () => null)
        finishInitialRefresh(null)
        await synced
      }
      await notifyRestoredPlaybackCookie(io, room.id, 'netease')

      const recoveryCalls = url.mock.calls.filter(([, , , cookie]) => cookie === 'owner-vip-cookie')
      const plays = emit.mock.calls.filter(([event]) => event === EVENTS.PLAYER_PLAY)
      if (arrival === 'after a manual pause') {
        expect(recoveryCalls).toHaveLength(0)
        expect(plays).toHaveLength(0)
      } else {
        expect(recoveryCalls).toHaveLength(1)
        expect(plays).toEqual([[EVENTS.PLAYER_PLAY, expect.objectContaining({
          track: expect.objectContaining({ id: 'playing', streamUrl: freshUrl }),
          playState: expect.objectContaining({ isPlaying: true, revision: 4 }),
        })]])
      }
    },
  )
})
