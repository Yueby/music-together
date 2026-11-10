// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTS, type RoomState } from '@music-together/shared'
import { useAuth } from './useAuth'
import { usePlaylist } from './usePlaylist'
import { useVersionCheck } from './useVersionCheck'
import { useMediaSession } from './useMediaSession'
import { useAuthSync } from './room/useAuthSync'
import { useRoomState } from './room/useRoomState'
import { useRoomStore } from '@/stores/roomStore'
import { usePlayerStore } from '@/stores/playerStore'

const fixture = vi.hoisted(() => ({
  runtime: {
    kind: 'mapp' as 'web' | 'mapp',
    platformAccounts: false,
    nativeMediaSession: false,
    versionCheck: false,
    pixiBackground: false,
    clipboard: false,
    externalLinks: false,
  },
  socket: { id: 'fixture-socket', on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  getCookies: vi.fn(() => [{ platform: 'netease', cookie: 'fixture-only-cookie' }]),
  saveCookie: vi.fn(),
  removeCookie: vi.fn(),
  saveTicket: vi.fn(),
  metadata: vi.fn(async () => ({
    ok: true,
    json: async () => ({ version: 'fixture-version', tracks: [], hasMore: false }),
  })),
  navigate: vi.fn(),
}))
vi.mock('@/lib/hostRuntime', () => ({ hostRuntime: fixture.runtime }))
vi.mock('@/providers/SocketProvider', () => ({
  useSocketContext: () => ({ socket: fixture.socket, isConnected: true }),
}))
vi.mock('@/lib/storage', () => ({
  storage: {
    getUserId: () => 'fixture-user',
    getVolume: () => 0.8,
    getAuthCookies: fixture.getCookies,
    upsertAuthCookie: fixture.saveCookie,
    removeAuthCookie: fixture.removeCookie,
    setRejoinToken: fixture.saveTicket,
  },
}))
vi.mock('@/lib/metadataFetch', () => ({ metadataFetch: fixture.metadata }))
vi.mock('react-router', () => ({ useNavigate: () => fixture.navigate }))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn(), loading: vi.fn() },
}))

const room = (): RoomState => ({
  id: 'ABC123',
  name: 'Fixture',
  creatorId: 'fixture-user',
  hostId: 'fixture-user',
  conductorSocketId: 'fixture-socket',
  hasPassword: false,
  audioQuality: 128,
  queue: [],
  currentTrack: null,
  users: [{ id: 'fixture-user', nickname: 'Fixture', role: 'owner' }],
  playState: { isPlaying: false, currentTime: 0, serverTimestamp: 0, revision: 0 },
  playMode: 'sequential',
})

// Never a real browser account or socket. These callbacks are owned by the rendered hook tree.
describe('host capability guards on shared hooks', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let auth: ReturnType<typeof useAuth>
  let playlists: ReturnType<typeof usePlaylist>
  let listeners: Map<string, Set<(...args: unknown[]) => void>>
  let media: {
    setActionHandler: ReturnType<typeof vi.fn>
    setPositionState: ReturnType<typeof vi.fn>
    playbackState: string
    metadata: unknown
  }
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(fixture.runtime, {
      kind: 'mapp',
      platformAccounts: false,
      nativeMediaSession: false,
      versionCheck: false,
    })
    listeners = new Map()
    fixture.socket.on.mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(listener)
    })
    fixture.socket.off.mockImplementation((event: string, listener: (...args: unknown[]) => void) =>
      listeners.get(event)?.delete(listener),
    )
    media = { setActionHandler: vi.fn(), setPositionState: vi.fn(), playbackState: 'none', metadata: null }
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: media })
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('__APP_VERSION__', 'fixture-version')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('NATIVE_FETCH_TRIPWIRE')
      }),
    )
    useRoomStore.getState().reset()
    usePlayerStore.getState().reset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(navigator, 'mediaSession')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  async function render() {
    function Harness() {
      auth = useAuth()
      playlists = usePlaylist()
      useVersionCheck()
      useAuthSync()
      useRoomState()
      useMediaSession({ play: vi.fn(), pause: vi.fn(), next: vi.fn(), prev: vi.fn(), seek: vi.fn() })
      return null
    }
    await act(async () => root.render(<Harness />))
  }
  async function fire(event: string, ...args: unknown[]) {
    await act(async () => {
      for (const listener of listeners.get(event) ?? []) listener(...args)
    })
  }

  it('keeps accounts, browser media controls and version checks dormant for Mapp', async () => {
    await render()
    await act(async () => {
      auth.requestQrCode('netease')
      auth.checkQrStatus('fixture-key')
      auth.setCookie('netease', 'fixture-only-input')
      auth.logout('netease')
      playlists.fetchMyPlaylists('netease')
    })
    await fire(EVENTS.ROOM_STATE, room())
    await fire(EVENTS.ROOM_REJOIN_TOKEN, {
      roomId: 'ABC123',
      token: 'fixture-only-ticket',
      expiresAt: Date.now() + 1000,
    })
    expect(fixture.socket.emit).not.toHaveBeenCalled()
    expect(fixture.metadata).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(fixture.getCookies).not.toHaveBeenCalled()
    expect(fixture.saveCookie).not.toHaveBeenCalled()
    expect(fixture.removeCookie).not.toHaveBeenCalled()
    expect(fixture.saveTicket).not.toHaveBeenCalled()
    expect(media.setActionHandler).not.toHaveBeenCalled()
    expect(listeners.has(EVENTS.AUTH_SET_COOKIE_RESULT)).toBe(false)
    expect(listeners.has(EVENTS.AUTH_QR_GENERATED)).toBe(false)
  })

  it('reads public playlists and albums through the metadata transport on Mapp too, without a room or credentials', async () => {
    useRoomStore.setState({ room: room() })
    await render()
    await act(async () => {
      await playlists.fetchPlaylistTracks('netease', 'fixture-public-list', 12, 'album')
    })
    const [url, init] = fixture.metadata.mock.calls.at(-1) as unknown as [string, RequestInit]
    const query = new URL(url, 'https://music.test').searchParams
    expect(new URL(url, 'https://music.test').pathname).toBe('/api/music/playlist')
    expect(Object.fromEntries(query)).toEqual({
      source: 'netease',
      id: 'fixture-public-list',
      limit: '200',
      offset: '0',
      total: '12',
      type: 'album',
    })
    // The host has no music accounts: no room scope (and so no account cookie) is ever requested.
    expect(query.has('roomId')).toBe(false)
    expect(init).toBeDefined()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('retains Web status, credential recovery, collection requests and browser media behavior', async () => {
    Object.assign(fixture.runtime, {
      kind: 'web',
      platformAccounts: true,
      nativeMediaSession: true,
      versionCheck: true,
    })
    await render()
    expect(fixture.socket.emit).toHaveBeenCalledWith(EVENTS.AUTH_GET_STATUS)
    expect(fixture.metadata).toHaveBeenCalledWith(
      expect.stringContaining('/api/version'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(media.setActionHandler).toHaveBeenCalled()
    await fire(EVENTS.ROOM_STATE, room())
    expect(fixture.socket.emit).toHaveBeenCalledWith(EVENTS.AUTH_SET_COOKIE, {
      platform: 'netease',
      cookie: 'fixture-only-cookie',
    })
    await act(async () => {
      auth.requestQrCode('netease')
      playlists.fetchMyPlaylists('netease')
    })
    expect(fixture.socket.emit).toHaveBeenCalledWith(EVENTS.AUTH_REQUEST_QR, { platform: 'netease' })
    expect(fixture.socket.emit).toHaveBeenCalledWith(EVENTS.PLAYLIST_GET_MY, { platform: 'netease' })
    await fire(EVENTS.ROOM_REJOIN_TOKEN, { roomId: 'ABC123', token: 'fixture-only-ticket', expiresAt: 1234 })
    expect(fixture.saveTicket).toHaveBeenCalledExactlyOnceWith('ABC123', 'fixture-only-ticket', 1234)
    await act(async () => {
      await playlists.fetchPlaylistTracks('netease', 'fixture-public-list')
    })
    expect(fixture.metadata).toHaveBeenCalledWith(expect.stringContaining('/api/music/playlist?'), {
      credentials: 'include',
    })
    // The caller's own list is a different, identity-checked endpoint that carries the room.
    await act(async () => {
      await playlists.fetchPlaylistTracks('netease', 'fixture-own-list', 5, 'playlist', true)
    })
    const lastCall = fixture.metadata.mock.calls.at(-1) as unknown as [string]
    const own = new URL(lastCall[0], 'https://music.test')
    expect(own.pathname).toBe('/api/music/playlist/mine')
    expect(own.searchParams.get('roomId')).toBe('ABC123')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
