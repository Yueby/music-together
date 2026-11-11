import { afterEach, describe, expect, it } from 'vitest'
import { roomRepo } from '../repositories/roomRepository.js'
import { toPublicRoomState } from '../utils/roomUtils.js'
import { createRoom, joinRoom, leaveRoom, setUserRole, updateSettings, validateJoinRequest } from './roomService.js'

const ROOM_ID = 'ROOM01'

function createTestRoom() {
  const { room } = createRoom('socket-owner', 'Owner', 'Room', null, 'owner')
  // Use a stable ID so the assertions and cleanup stay deterministic.
  roomRepo.delete(room.id)
  room.id = ROOM_ID
  roomRepo.set(ROOM_ID, room)
  roomRepo.setSocketMapping('socket-owner', ROOM_ID, 'owner')
  return room
}

afterEach(() => {
  for (const roomId of roomRepo.getAllIds()) roomRepo.delete(roomId)
  for (const socketId of ['socket-owner', 'socket-admin', 'socket-member-1', 'socket-member-2', 'socket-owner-new']) {
    roomRepo.deleteSocketMapping(socketId)
  }
})

describe('roomService role and host reconciliation', () => {
  it('creates the room creator as owner and host', () => {
    const room = createTestRoom()

    expect(room.creatorId).toBe('owner')
    expect(room.hostId).toBe('owner')
    expect(room.users).toEqual([{ id: 'owner', nickname: 'Owner', role: 'owner' }])
  })

  it('hands host duties to a persistent admin when the creator leaves', () => {
    const room = createTestRoom()
    joinRoom('socket-admin', ROOM_ID, 'Admin', 'admin')
    expect(setUserRole(ROOM_ID, 'admin', 'admin').success).toBe(true)

    const result = leaveRoom('socket-owner')

    expect(result?.hostChanged).toBe(true)
    expect(room.hostId).toBe('admin')
    expect(room.temporaryAdminUserId).toBeNull()
    expect(room.users).toEqual([{ id: 'admin', nickname: 'Admin', role: 'admin' }])
  })

  it('promotes the earliest online member temporarily when no permanent controller remains', () => {
    const room = createTestRoom()
    joinRoom('socket-member-1', ROOM_ID, 'Member 1', 'member-1')
    joinRoom('socket-member-2', ROOM_ID, 'Member 2', 'member-2')

    leaveRoom('socket-owner')

    expect(room.temporaryAdminUserId).toBe('member-1')
    expect(room.hostId).toBe('member-1')
    expect(room.users).toEqual([
      { id: 'member-1', nickname: 'Member 1', role: 'admin' },
      { id: 'member-2', nickname: 'Member 2', role: 'member' },
    ])
  })

  it('restores the creator and demotes the temporary controller when the creator returns', () => {
    const room = createTestRoom()
    joinRoom('socket-member-1', ROOM_ID, 'Member 1', 'member-1')
    leaveRoom('socket-owner')

    const result = joinRoom('socket-owner-new', ROOM_ID, 'Owner Returned', 'owner')

    expect(result?.hostChanged).toBe(true)
    expect(room.hostId).toBe('owner')
    expect(room.temporaryAdminUserId).toBeNull()
    expect(room.users.find((user) => user.id === 'owner')).toMatchObject({ role: 'owner' })
    expect(room.users.find((user) => user.id === 'member-1')).toMatchObject({ role: 'member' })
  })

  it('restores a persistent admin and removes a temporary promotion while the creator is offline', () => {
    const room = createTestRoom()
    joinRoom('socket-admin', ROOM_ID, 'Admin', 'admin')
    setUserRole(ROOM_ID, 'admin', 'admin')
    joinRoom('socket-member-1', ROOM_ID, 'Member 1', 'member-1')
    leaveRoom('socket-admin')
    leaveRoom('socket-owner')
    expect(room.temporaryAdminUserId).toBe('member-1')

    const result = joinRoom('socket-admin', ROOM_ID, 'Admin Returned', 'admin')

    expect(result?.hostChanged).toBe(true)
    expect(room.hostId).toBe('admin')
    expect(room.temporaryAdminUserId).toBeNull()
    expect(room.users.find((user) => user.id === 'admin')).toMatchObject({ role: 'admin' })
    expect(room.users.find((user) => user.id === 'member-1')).toMatchObject({ role: 'member' })
  })

  it('revokes a persistent administrator while they are offline', () => {
    const room = createTestRoom()
    joinRoom('socket-admin', ROOM_ID, 'Admin', 'admin')
    expect(setUserRole(ROOM_ID, 'admin', 'admin').success).toBe(true)
    leaveRoom('socket-admin')

    expect(setUserRole(ROOM_ID, 'admin', 'member')).toEqual({
      success: true,
      roleChanged: true,
      hostChanged: false,
    })
    expect(room.adminUserIds.has('admin')).toBe(false)
    expect(validateJoinRequest(ROOM_ID, 'socket-admin', 'admin')).toMatchObject({
      valid: true,
      skipPassword: false,
    })
  })

  it('moves conductor ownership to the newest socket for the host identity', () => {
    const room = createTestRoom()

    const result = joinRoom('socket-owner-new', ROOM_ID, 'Owner New Socket', 'owner')

    expect(result?.hostChanged).toBe(true)
    expect(room.conductorSocketId).toBe('socket-owner-new')
  })

  it('ignores a stale non-conductor socket disconnect when the same user has a newer socket', () => {
    const room = createTestRoom()
    joinRoom('socket-owner-new', ROOM_ID, 'Owner New Socket', 'owner')

    const result = leaveRoom('socket-owner')

    expect(result?.staleSocketOnly).toBe(true)
    expect(result?.hostChanged).toBe(false)
    expect(room.hostId).toBe('owner')
    expect(room.users).toHaveLength(1)
    expect(room.users[0]).toMatchObject({ id: 'owner', role: 'owner' })
  })

  it('reports a conductor change when the newest host socket disconnects', () => {
    const room = createTestRoom()
    joinRoom('socket-owner-new', ROOM_ID, 'Owner New Socket', 'owner')

    const result = leaveRoom('socket-owner-new')

    expect(result?.staleSocketOnly).toBe(true)
    expect(result?.hostChanged).toBe(true)
    expect(room.conductorSocketId).toBe('socket-owner')
  })

  it('re-anchors playback time when only the conductor socket changes, without bumping revision', () => {
    const room = createTestRoom()
    room.playState = { isPlaying: true, currentTime: 10, serverTimestamp: Date.now() - 5_000, revision: 0 }
    const before = Date.now()

    const result = joinRoom('socket-owner-new', ROOM_ID, 'Owner New Socket', 'owner')

    expect(result?.hostChanged).toBe(true)
    expect(room.conductorSocketId).toBe('socket-owner-new')
    // Socket-only switch is not a new action — the generation must stay put.
    expect(room.playState.revision).toBe(0)
    expect(room.playState.currentTime).toBeCloseTo(15, 1)
    expect(room.playState.serverTimestamp).toBeGreaterThanOrEqual(before)
  })

  it('re-anchors playback time when the conductor transfers to a stale successor socket', () => {
    const room = createTestRoom()
    joinRoom('socket-owner-new', ROOM_ID, 'Owner New Socket', 'owner')
    room.playState = { isPlaying: true, currentTime: 20, serverTimestamp: Date.now() - 4_000, revision: 1 }
    const before = Date.now()

    const result = leaveRoom('socket-owner-new')

    expect(result?.staleSocketOnly).toBe(true)
    expect(result?.hostChanged).toBe(true)
    expect(room.conductorSocketId).toBe('socket-owner')
    expect(room.playState.revision).toBe(1)
    expect(room.playState.currentTime).toBeCloseTo(24, 1)
    expect(room.playState.serverTimestamp).toBeGreaterThanOrEqual(before)
  })

  it('still bumps the revision when a different user takes over as host', () => {
    const room = createTestRoom()
    joinRoom('socket-admin', ROOM_ID, 'Admin', 'admin')
    setUserRole(ROOM_ID, 'admin', 'admin')
    room.playState = { isPlaying: true, currentTime: 30, serverTimestamp: Date.now() - 2_000, revision: 4 }

    const result = leaveRoom('socket-owner')

    expect(result?.hostChanged).toBe(true)
    expect(room.hostId).toBe('admin')
    expect(room.playState.revision).toBe(5)
    expect(room.playState.currentTime).toBeCloseTo(32, 1)
  })
})

describe('roomService queue mode', () => {
  it('starts a room keeping its tracks, and shows the mode in the public state', () => {
    const room = createTestRoom()
    expect(room.queueMode).toBe('keep')
    expect(toPublicRoomState(room).queueMode).toBe('keep')
  })

  it('switches the mode in both directions, and leaves it alone when a setting that is not about it changes', () => {
    const room = createTestRoom()

    updateSettings(ROOM_ID, { queueMode: 'consume' })
    expect(room.queueMode).toBe('consume')
    expect(toPublicRoomState(room).queueMode).toBe('consume')

    updateSettings(ROOM_ID, { name: 'Renamed' })
    expect(room.queueMode).toBe('consume')

    updateSettings(ROOM_ID, { queueMode: 'keep' })
    expect(room.queueMode).toBe('keep')
  })

  it('keeps the play mode that was chosen, so it is back when the queue is kept again', () => {
    const room = createTestRoom()
    room.playMode = 'loop-one'
    updateSettings(ROOM_ID, { queueMode: 'consume' })
    expect(room.playMode).toBe('loop-one')
  })
})
