import { afterEach, describe, expect, it, vi } from 'vitest'
import { EVENTS, type Track } from '@music-together/shared'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { attachSocketIdentity } from '../middleware/socketIdentity.js'
import { registerRoomController } from './roomController.js'
import { registerQueueController } from './queueController.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { chatRepo } from '../repositories/chatRepository.js'
import { clearAllTimers } from '../services/roomLifecycleService.js'
import { revokeRejoinTickets } from '../services/rejoinTicketService.js'
import { autoPlayIfEmpty } from '../services/playerService.js'
import { createPlatformResolvers, mapPlatformUserId, type PlatformAuth } from '../services/platformAuth.js'

vi.mock('../services/identityService.js', () => ({
  getIdentityFromCookieHeader: (header?: string) => (header === 'fixture-web-cookie' ? { userId: 'web-owner' } : null),
}))
vi.mock('../services/playerService.js', () => ({
  autoPlayIfEmpty: vi.fn(async () => {}),
  syncPlaybackToSocket: vi.fn(async () => {}),
  cleanupRoom: vi.fn(),
  stopSafe: vi.fn(),
}))
vi.mock('../middleware/socketRateLimiter.js', () => ({
  checkSocketRateLimit: vi.fn(async () => true),
  checkRoomEntryRateLimit: vi.fn(async () => true),
  isJoinPasswordLocked: vi.fn(async () => false),
  recordJoinPasswordFailure: vi.fn(async () => {}),
  clearJoinPasswordFailures: vi.fn(async () => {}),
}))
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

type Handler = (payload?: unknown) => void | Promise<void>
type PacketGuard = (packet: unknown[], next: () => void) => void
type Peer = ReturnType<typeof peer>
const peers = new Map<string, Peer>()
const principal = { iss: 'https://linux.do', sub: '123' }
const track: Track = {
  id: 'fixture-track',
  source: 'netease',
  sourceId: '123',
  urlId: '123',
  title: 'Fixture track',
  artist: ['Fixture artist'],
  album: 'Fixture album',
  cover: 'https://example.test/cover.jpg',
  duration: 120,
}

function peer(id: string, platform = false) {
  const handlers = new Map<string, Handler>()
  const packetGuards: PacketGuard[] = []
  const rooms = new Set<string>()
  const emit = vi.fn()
  const url = '/socket.io/?EIO=4&transport=websocket' + (platform ? '&mini_app_token=fixture-platform-token' : '')
  return {
    id,
    data: { identityUserId: '' },
    handlers,
    packetGuards,
    rooms,
    emit,
    request: {
      url,
      headers: { origin: platform ? principal.iss : 'https://music.example.test' },
      socket: { destroyed: false, end: vi.fn() },
    },
    handshake: {
      url,
      headers: {
        cookie: platform ? undefined : 'fixture-web-cookie',
        origin: platform ? principal.iss : 'https://music.example.test',
      },
      auth: { userId: 'web-owner' },
    },
    on: vi.fn((name: string, handler: Handler) => {
      handlers.set(name, handler)
    }),
    use: vi.fn((guard: PacketGuard) => {
      packetGuards.push(guard)
    }),
    join: vi.fn((name: string) => {
      rooms.add(name)
    }),
    leave: vi.fn((name: string) => {
      rooms.delete(name)
    }),
    to: (name: string) => ({ emit: (event: string, data: unknown) => broadcast(name, event, data, id) }),
  }
}

function broadcast(room: string, event: string, data: unknown, except?: string) {
  for (const p of peers.values()) if (p.id !== except && p.rooms.has(room)) p.emit(event, data)
}

function server() {
  return {
    to: (name: string) => ({ emit: (event: string, data: unknown) => broadcast(name, event, data) }),
    emit: vi.fn(),
  } as unknown as TypedServer
}

async function authenticatedPeer(id: string, platform = false) {
  const p = peer(id, platform)
  const io = server()
  let guard!: (socket: TypedSocket, next: (error?: Error) => void) => void
  let onConnected: ((socket: TypedSocket) => void) | undefined
  let upgrade!: (req: unknown, res: unknown, next: () => void) => Promise<void>
  const middlewareIo = {
    engine: {
      use: (value: typeof upgrade) => {
        upgrade = value
      },
    },
    use: (value: typeof guard) => {
      guard = value
    },
    on: (event: string, handler: (socket: TypedSocket) => void) => {
      if (event === 'connection') onConnected = handler
    },
  } as unknown as TypedServer
  const auth = { verifyRoomSocket: vi.fn(async () => principal) } as unknown as PlatformAuth
  attachSocketIdentity(middlewareIo, { resolvePlatformIdentity: createPlatformResolvers(auth).roomSocket })
  // Platform tokens are verified before the upgrade; only then does the Socket.IO guard run.
  await new Promise<void>((resolve, reject) => {
    const connect = () => guard(p as unknown as TypedSocket, (error) => (error ? reject(error) : resolve()))
    void upgrade(p.request, {}, connect)
  })
  onConnected?.(p as unknown as TypedSocket)
  peers.set(id, p)
  registerRoomController(io, p as unknown as TypedSocket)
  registerQueueController(io, p as unknown as TypedSocket)
  return { p, io }
}

async function command(p: Peer, event: string, payload?: unknown) {
  for (const guard of p.packetGuards) {
    let allowed = false
    guard([event, payload], () => {
      allowed = true
    })
    if (!allowed) return
  }
  const handler = p.handlers.get(event)
  if (!handler) throw new Error('Controller handler missing')
  await Reflect.apply(handler, p, [payload])
}

function lastPayload(p: Peer, event: string) {
  return p.emit.mock.calls.filter(([name]) => name === event).at(-1)?.[1]
}

afterEach(() => {
  for (const id of roomRepo.getAllIds()) {
    revokeRejoinTickets(id)
    roomRepo.delete(id)
    chatRepo.deleteRoom(id)
  }
  for (const id of peers.keys()) roomRepo.deleteSocketMapping(id)
  peers.clear()
  clearAllTimers()
  vi.clearAllMocks()
})

describe('platform identity with existing room and queue controllers', () => {
  it('joins a Web room with a distinct verified identity and broadcasts the same queue to both peers', async () => {
    const { p: web } = await authenticatedPeer('web-socket')
    const { p: mini, io } = await authenticatedPeer('mapp-socket', true)
    await command(web, EVENTS.ROOM_CREATE, { nickname: 'Owner', roomName: 'Shared fixture room' })
    const { roomId } = lastPayload(web, EVENTS.ROOM_CREATED) as { roomId: string }
    await command(mini, EVENTS.ROOM_JOIN, { roomId, nickname: 'Owner' })
    const room = roomRepo.get(roomId)!
    const id = mapPlatformUserId(principal)
    expect(room.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'web-owner', role: 'owner' }),
        expect.objectContaining({ id, role: 'member' }),
      ]),
    )
    expect(id).not.toBe('web-owner')
    expect(lastPayload(mini, EVENTS.IDENTITY_READY)).toEqual({ userId: id })
    expect(lastPayload(web, EVENTS.IDENTITY_READY)).toBeUndefined()
    expect(room.conductorSocketId).toBe(web.id)
    expect(lastPayload(mini, EVENTS.ROOM_STATE)).toMatchObject({ id: roomId })
    await command(mini, EVENTS.QUEUE_ADD, { track })
    expect(room.queue).toHaveLength(1)
    expect(lastPayload(web, EVENTS.QUEUE_UPDATED)).toMatchObject({ queue: [expect.objectContaining({ id: track.id })] })
    expect(lastPayload(mini, EVENTS.QUEUE_UPDATED)).toMatchObject({
      queue: [expect.objectContaining({ id: track.id })],
    })
    expect(autoPlayIfEmpty).toHaveBeenCalledWith(io, roomId, expect.objectContaining({ id: track.id }))
    await command(mini, EVENTS.ROOM_SETTINGS, { name: 'Unauthorized rename' })
    expect(room.name).toBe('Shared fixture room')
    expect(mini.emit).toHaveBeenCalledWith(EVENTS.ROOM_ERROR, expect.anything())
    // Music-account events are part of the reviewed platform channel: they reach the same controllers a Web user's do.
    const credentials = vi.fn()
    mini.handlers.set(EVENTS.AUTH_SET_COOKIE, credentials)
    await command(mini, EVENTS.AUTH_SET_COOKIE, { platform: 'netease', cookie: 'fixture-only' })
    expect(credentials).toHaveBeenCalledExactlyOnceWith({ platform: 'netease', cookie: 'fixture-only' })
    // Anything outside the reviewed list is still refused.
    const unknown = vi.fn()
    mini.handlers.set('admin:dump', unknown)
    await command(mini, 'admin:dump', {})
    expect(unknown).not.toHaveBeenCalled()
  })

  it('does not let verified forum identity or matching nickname bypass a Web room password', async () => {
    const { p: web } = await authenticatedPeer('password-web')
    const { p: mini } = await authenticatedPeer('password-mapp', true)
    await command(web, EVENTS.ROOM_CREATE, { nickname: 'Owner', password: 'fixture-password' })
    const { roomId } = lastPayload(web, EVENTS.ROOM_CREATED) as { roomId: string }
    await command(mini, EVENTS.ROOM_JOIN, { roomId, nickname: 'Owner' })
    expect(roomRepo.get(roomId)?.users).toHaveLength(1)
    expect(roomRepo.getSocketMapping(mini.id)).toBeUndefined()
    expect(mini.emit).toHaveBeenCalledWith(EVENTS.ROOM_ERROR, expect.anything())
  })

  it('lets a Web member join a platform-created room through the same controllers', async () => {
    const { p: mini } = await authenticatedPeer('platform-owner', true)
    const { p: web } = await authenticatedPeer('web-member')
    await command(mini, EVENTS.ROOM_CREATE, { nickname: 'Forum owner', roomName: 'Platform fixture room' })
    const { roomId } = lastPayload(mini, EVENTS.ROOM_CREATED) as { roomId: string }
    await command(web, EVENTS.ROOM_JOIN, { roomId, nickname: 'Web member' })
    const room = roomRepo.get(roomId)!
    expect(room.creatorId).toBe(mapPlatformUserId(principal))
    expect(room.users.find((u) => u.id === 'web-owner')?.role).toBe('member')
    await command(web, EVENTS.QUEUE_ADD, { track })
    expect(lastPayload(mini, EVENTS.QUEUE_UPDATED)).toMatchObject({
      queue: [expect.objectContaining({ id: track.id })],
    })
    expect(lastPayload(web, EVENTS.QUEUE_UPDATED)).toMatchObject({ queue: [expect.objectContaining({ id: track.id })] })
  })

  it('preserves the platform creator across a new socket without changing the room business model', async () => {
    const { p: first } = await authenticatedPeer('platform-old', true)
    await command(first, EVENTS.ROOM_CREATE, { nickname: 'Forum creator', password: 'fixture-password' })
    const { roomId } = lastPayload(first, EVENTS.ROOM_CREATED) as { roomId: string }
    const { p: returned } = await authenticatedPeer('platform-new', true)
    await command(returned, EVENTS.ROOM_JOIN, { roomId, nickname: 'Forum returned' })
    const room = roomRepo.get(roomId)!
    expect(room.users).toHaveLength(1)
    expect(room.users[0]?.role).toBe('owner')
    expect(room.users[0]?.id).toBe(first.data.identityUserId)
    expect(room.conductorSocketId).toBe(returned.id)
  })
})
