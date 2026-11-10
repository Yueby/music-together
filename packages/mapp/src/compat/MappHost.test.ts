import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MiniAppSDK } from '@discourse-mini-app/sdk'
import type { Track } from '@music-together/shared'
import type { MetadataFetch, MetadataResponse } from '../../../client/src/lib/MetadataTransport.ts'
import type { PlaybackSound, PlaybackSoundOptions } from '../../../client/src/lib/PlaybackSound.ts'
import type { MappPlaybackSoundFactoryOptions } from './MappPlaybackSoundFactory.ts'
import type { MappRoomSession, MappRoomSessionOptions, MappRoomSessionSnapshot } from './RoomSession.ts'
import { createMappHost, type MappHost, type MappHostOptions } from './MappHost.ts'
import { clearMemoryStorage, storageBackend } from './storageBackend.ts'

const mocks = vi.hoisted(() => ({
  getSDK: vi.fn(),
  session: vi.fn(),
  audio: vi.fn(),
  metadata: vi.fn(),
  cover: vi.fn(),
  commands: vi.fn(),
}))
vi.mock('@discourse-mini-app/sdk', () => ({ getSDK: mocks.getSDK }))
vi.mock('./RoomSession.ts', () => ({ createMappRoomSession: mocks.session }))
vi.mock('./MappPlaybackSoundFactory.ts', () => ({ createMappPlaybackSoundFactory: mocks.audio }))
vi.mock('./metadataFetch.ts', () => ({ createMappMetadataFetch: mocks.metadata }))
vi.mock('./coverLoader.ts', () => ({ createMappCoverLoader: mocks.cover }))
vi.mock('./MappRoomCommands.ts', () => ({ createMappRoomCommands: mocks.commands }))

const options: MappHostOptions = {
  endpoint: 'roomSocket',
  reviewedEndpointUrl: 'wss://music.example/socket.io/?EIO=4&transport=websocket',
}
const track = { id: 'netease:1' } as Track
const soundOptions: PlaybackSoundOptions = { src: ['https://unused.invalid/source'] }
const response: MetadataResponse = {
  ok: true,
  status: 200,
  json: async () => ({ tracks: [] }),
  text: async () => '{"tracks":[]}',
}
const initial: MappRoomSessionSnapshot = {
  status: 'idle',
  connected: false,
  userId: null,
  roomId: null,
  errorCode: null,
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
async function flush() {
  for (let i = 0; i < 12; ++i) await Promise.resolve()
}
const hosts: MappHost[] = []
let nativeAccess: ReturnType<typeof vi.fn<() => never>>

function fixture() {
  let sessionOptions!: MappRoomSessionOptions
  let snapshot = initial
  const has = vi.fn(() => true)
  const request = vi.fn()
  const sdkConnect = vi.fn()
  const sdk = {
    ready: Promise.resolve(),
    permissions: { has },
    http: { request },
    webSocket: { connect: sdkConnect },
  } as unknown as MiniAppSDK
  for (const name of ['cookies', 'localStorage', 'user'] as const) {
    Object.defineProperty(sdk, name, { get: nativeAccess })
  }
  const emit = vi.fn()
  const session: MappRoomSession = {
    socket: { emit } as unknown as MappRoomSession['socket'],
    get snapshot() {
      return snapshot
    },
    connect: vi.fn(),
    createRoom: vi.fn(() => true),
    joinRoom: vi.fn(() => true),
    leaveRoom: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    dispose: vi.fn(),
  }
  const handles: PlaybackSound[] = []
  const audio = {
    allowLoadRetry: false,
    supportsHtml5Analysis: false,
    create: vi.fn((_track: Track, _options: PlaybackSoundOptions): PlaybackSound => {
      const handle = { unload: vi.fn() } as unknown as PlaybackSound
      handles.push(handle)
      return handle
    }),
    unlock: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    dispose: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  }
  const fetchMetadata = vi.fn<MetadataFetch>().mockResolvedValue(response)
  const commands = { create: vi.fn(), join: vi.fn(), leave: vi.fn() }
  mocks.getSDK.mockReturnValue(sdk)
  mocks.session.mockImplementation((input: MappRoomSessionOptions) => {
    sessionOptions = input
    // RoomSession's socket obtains the same module SDK rather than receiving a second instance.
    expect(mocks.getSDK()).toBe(sdk)
    return session
  })
  mocks.audio.mockReturnValue(audio)
  mocks.metadata.mockReturnValue(fetchMetadata)
  const covers = { direct: false, load: vi.fn(), dispose: vi.fn() }
  mocks.cover.mockReturnValue(covers)
  mocks.commands.mockReturnValue(commands)
  const make = (overrides: Partial<MappHostOptions> = {}) => {
    const host = createMappHost({ ...options, ...overrides })
    hosts.push(host)
    return host
  }
  const publish = (patch: Partial<MappRoomSessionSnapshot> = {}, extra: Record<string, unknown> = {}) => {
    snapshot = { ...snapshot, ...patch }
    sessionOptions.onChange?.({ ...snapshot, ...extra })
  }
  const joined = () => publish({ status: 'joined', connected: true, userId: 'canonical-id', roomId: 'room-A' })
  const audioOptions = () => mocks.audio.mock.calls[0][0] as MappPlaybackSoundFactoryOptions
  return {
    make,
    publish,
    joined,
    audioOptions,
    sdk,
    has,
    request,
    sdkConnect,
    session,
    emit,
    audio,
    handles,
    fetchMetadata,
    covers,
    commands,
  }
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  clearMemoryStorage()
  nativeAccess = vi.fn(() => {
    throw new Error('Forbidden native or credential access')
  })
  for (const name of ['WebSocket', 'fetch', 'localStorage', 'sessionStorage', 'AudioContext', 'XMLHttpRequest']) {
    vi.stubGlobal(name, nativeAccess)
  }
  vi.stubGlobal('document', {
    get cookie() {
      return nativeAccess()
    },
  })
})
afterEach(async () => {
  for (const host of hosts.splice(0)) await host.dispose().catch(() => {})
  await flush()
  expect(nativeAccess).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  clearMemoryStorage()
})

describe('MappHost thin composition', () => {
  it('cancels a waiting room pre-check before session cleanup even if no disconnect notification is delivered', async () => {
    const f = fixture()
    const on = vi.fn()
    const off = vi.fn()
    Object.assign(f.session.socket, { on, off, connected: false })
    const host = f.make()
    const work = host.roomCheck(f.session.socket, 'ABC123')
    const stopped = expect(work).rejects.toMatchObject({ name: 'AbortError' })
    expect(f.session.subscribe).toHaveBeenCalledOnce()
    expect(f.emit).not.toHaveBeenCalled()
    await host.dispose()
    await stopped
    expect(on).toHaveBeenCalledTimes(2)
    expect(off).toHaveBeenCalledTimes(2)
    expect(vi.mocked(f.session.subscribe).mock.results[0].value).toHaveBeenCalledOnce()
    expect(f.session.connect).not.toHaveBeenCalled()
    expect(f.fetchMetadata).not.toHaveBeenCalled()
  })

  it('constructs synchronously with shared SDK/origin and no I/O or AudioContext', async () => {
    const f = fixture()
    const createAudioContext = vi.fn<() => AudioContext>()
    const host = f.make({ timeoutMs: 1234, mediaMode: 'bytes', createAudioContext })
    expect(host).not.toBeInstanceOf(Promise)
    expect(Object.isFrozen(host)).toBe(true)
    expect(host.serverOrigin).toBe('https://music.example')
    expect(host.session).toBe(f.session)
    expect(host.roomCommands).toBe(f.commands)
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith({
      ...options,
      timeoutMs: 1234,
      onChange: expect.any(Function),
    })
    expect(mocks.commands).toHaveBeenCalledExactlyOnceWith(f.session)
    expect(mocks.metadata).toHaveBeenCalledExactlyOnceWith({ sdk: f.sdk, reviewedOrigin: host.serverOrigin })
    expect(f.audioOptions()).toEqual({
      sdk: f.sdk,
      mode: 'bytes',
      createContext: createAudioContext,
      getRoomId: expect.any(Function),
    })
    expect(f.audioOptions().getRoomId()).toBeNull()
    f.joined()
    expect(f.audioOptions().getRoomId()).toBe('room-A')
    expect(host.playbackSoundFactory.allowLoadRetry).toBe(false)
    expect(host.playbackSoundFactory.supportsHtml5Analysis).toBe(false)
    expect(host.playbackSoundFactory).not.toHaveProperty('unlock')
    expect(host.playbackSoundFactory).not.toHaveProperty('dispose')
    await flush()
    expect(f.session.connect).not.toHaveBeenCalled()
    expect(f.session.subscribe).not.toHaveBeenCalled()
    expect(f.request).not.toHaveBeenCalled()
    expect(f.sdkConnect).not.toHaveBeenCalled()
    expect(f.audio.create).not.toHaveBeenCalled()
    expect(f.audio.unlock).not.toHaveBeenCalled()
    expect(f.fetchMetadata).not.toHaveBeenCalled()
    expect(createAudioContext).not.toHaveBeenCalled()
    expect(f.emit).not.toHaveBeenCalled()
  })

  it('only explicitly connects, and never connects after disposal begins', async () => {
    const f = fixture()
    const host = f.make()
    host.connect()
    expect(f.session.connect).toHaveBeenCalledOnce()
    const closing = host.dispose()
    host.connect()
    expect(f.session.connect).toHaveBeenCalledOnce()
    expect(f.audioOptions().getRoomId()).toBeNull()
    await closing
  })

  it('uses only server-confirmed canonical identity and a fixed frozen public snapshot', () => {
    const f = fixture()
    storageBackend.setItem('mt-userId', 'stale-id')
    const observer = vi.fn()
    f.make({ onSessionChange: observer })
    expect(storageBackend.getItem('mt-userId')).toBeNull()
    f.publish({ connected: true, userId: 'server-id' })
    expect(storageBackend.getItem('mt-userId')).toBe('server-id')
    expect(observer.mock.lastCall![0]).toEqual({ ...initial, connected: true, userId: 'server-id' })
    expect(storageBackend.getItem('mt-nickname')).toBeNull()
    expect(storageBackend.getItem('mt-auth-cookies')).toBeNull()
    expect(storageBackend.getItem('mt-rejoin-token')).toBeNull()
    f.publish({ userId: null })
    expect(storageBackend.getItem('mt-userId')).toBeNull()
    expect(f.session.createRoom).not.toHaveBeenCalled()
    expect(f.session.joinRoom).not.toHaveBeenCalled()
  })

  it.each([
    { connected: false },
    { userId: null },
    { roomId: null },
    { roomId: 'room-B' },
    { userId: 'new-server-id' },
  ] satisfies Partial<MappRoomSessionSnapshot>[])(
    'unloads current media at confirmed boundary %j without business emits',
    (patch) => {
      const f = fixture()
      const host = f.make()
      f.joined()
      const first = host.playbackSoundFactory.create(track, soundOptions)
      const second = host.playbackSoundFactory.create(track, soundOptions)
      expect(f.audio.create).toHaveBeenLastCalledWith(track, soundOptions)
      expect(second).toBe(f.handles[1])
      f.publish(patch)
      expect(first.unload).not.toHaveBeenCalled()
      expect(second.unload).toHaveBeenCalledOnce()
      f.publish(patch)
      expect(second.unload).toHaveBeenCalledOnce()
      expect(f.emit).not.toHaveBeenCalled()
      expect(f.session.leaveRoom).not.toHaveBeenCalled()
    },
  )

  it('keeps media for same-room status changes and clears identity on dispose', async () => {
    const f = fixture()
    const host = f.make()
    f.joined()
    const sound = host.playbackSoundFactory.create(track, soundOptions)
    f.publish({ status: 'joining' })
    expect(sound.unload).not.toHaveBeenCalled()
    f.publish({ userId: 'replacement-id', roomId: 'room-B' })
    expect(sound.unload).toHaveBeenCalledOnce()
    expect(storageBackend.getItem('mt-userId')).toBe('replacement-id')
    await host.dispose()
    expect(f.audio.dispose).toHaveBeenCalledOnce()
    expect(storageBackend.getItem('mt-userId')).toBeNull()
  })
})

describe('MappHost explicit user-gesture audio unlock', () => {
  it('calls unlock synchronously before awaiting and becomes sticky only on success', async () => {
    const f = fixture()
    const pending = deferred<boolean>()
    f.audio.unlock.mockReturnValueOnce(pending.promise)
    const host = f.make()
    expect(host.isAudioUnlocked()).toBe(false)
    const result = host.unlockAudio()
    expect(f.audio.unlock).toHaveBeenCalledOnce()
    expect(host.isAudioUnlocked()).toBe(false)
    pending.resolve(true)
    await result
    expect(host.isAudioUnlocked()).toBe(true)
    f.audio.unlock.mockResolvedValueOnce(false)
    await expect(host.unlockAudio()).rejects.toThrow(/^MAPP_AUDIO_UNLOCK_FAILED$/)
    expect(host.isAudioUnlocked()).toBe(true)
    await host.dispose()
    expect(host.isAudioUnlocked()).toBe(false)
    await expect(host.unlockAudio()).rejects.toThrow(/^MAPP_AUDIO_UNLOCK_FAILED$/)
    expect(f.audio.unlock).toHaveBeenCalledTimes(2)
  })

  it.each(['false', 'reject'] as const)('sanitizes %s unlock failure', async (mode) => {
    const f = fixture()
    const host = f.make()
    if (mode === 'false') f.audio.unlock.mockResolvedValueOnce(false)
    if (mode === 'reject') f.audio.unlock.mockRejectedValueOnce(new Error('private fixture detail'))
    await expect(host.unlockAudio()).rejects.toThrow(/^MAPP_AUDIO_UNLOCK_FAILED$/)
    expect(host.isAudioUnlocked()).toBe(false)
  })

  it('does not accept a successful unlock delivered after disposal', async () => {
    const f = fixture()
    const pending = deferred<boolean>()
    f.audio.unlock.mockReturnValueOnce(pending.promise)
    const host = f.make()
    const result = host.unlockAudio()
    const assertion = expect(result).rejects.toThrow(/^MAPP_AUDIO_UNLOCK_FAILED$/)
    await host.dispose()
    pending.resolve(true)
    await assertion
    expect(host.isAudioUnlocked()).toBe(false)
  })
})

describe('MappHost artwork loader', () => {
  it('builds the loader from the shared SDK, exposes it, and releases it before closing the session', async () => {
    const f = fixture()
    const host = f.make()
    expect(mocks.cover).toHaveBeenCalledExactlyOnceWith({ sdk: f.sdk })
    expect(host.artworkLoader).toBe(f.covers)
    vi.mocked(f.session.dispose).mockImplementation(() => {
      // Session cleanup runs first; the loader is released in the same synchronous cleanup step.
      expect(f.covers.dispose).not.toHaveBeenCalled()
    })
    await host.dispose()
    expect(f.covers.dispose).toHaveBeenCalledOnce()
  })
})

describe('MappHost metadata lifetime', () => {
  it('forwards a linked signal that follows the caller without mutating init', async () => {
    const f = fixture()
    const host = f.make()
    const caller = new AbortController()
    const init = Object.freeze({ signal: caller.signal, credentials: 'include', method: 'GET' } as const)
    expect(await host.metadataFetch('/fixture', init)).toBe(response)
    const forwarded = f.fetchMetadata.mock.calls[0][1]!
    expect(forwarded).toEqual({ ...init, signal: expect.any(AbortSignal) })
    expect(forwarded.signal).not.toBe(caller.signal)
    expect(init.signal).toBe(caller.signal)
    expect(forwarded.signal?.aborted).toBe(false)
    caller.abort()
    expect(forwarded.signal?.aborted).toBe(true)
  })

  it('aborts in-flight requests before closing the session and rejects new requests', async () => {
    const f = fixture()
    f.fetchMetadata.mockReturnValue(new Promise(() => {}))
    const host = f.make()
    void host.metadataFetch('/fixture', { signal: new AbortController().signal })
    void host.metadataFetch('/fixture')
    const signals = f.fetchMetadata.mock.calls.map((call) => call[1]!.signal!)
    vi.mocked(f.session.dispose).mockImplementation(() => {
      expect(signals.every((signal) => signal.aborted)).toBe(true)
    })
    await host.dispose()
    expect(signals).toHaveLength(2)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    await expect(host.metadataFetch('/fixture')).rejects.toMatchObject({ name: 'AbortError' })
    expect(f.fetchMetadata).toHaveBeenCalledTimes(2)
  })

  it('uses existing reviewed metadata adapter whitelist, never native credentials or caller headers', async () => {
    const f = fixture()
    const actual = await vi.importActual<typeof import('./metadataFetch.ts')>('./metadataFetch.ts')
    mocks.metadata.mockImplementation(actual.createMappMetadataFetch)
    f.request.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: new TextEncoder().encode('{"tracks":[]}'),
    })
    const host = f.make()
    const result = await host.metadataFetch('https://music.example/api/music/search?source=netease&keyword=fixture', {
      credentials: 'include',
      method: 'GET',
    })
    expect(await result.json()).toEqual({ tracks: [] })
    const wire = f.request.mock.calls[0][1]
    expect(f.request.mock.calls[0][0]).toBe('musicSearch')
    expect(wire).not.toHaveProperty('credentials')
    expect(wire).not.toHaveProperty('headers')
    expect(wire).not.toHaveProperty('body')
    await expect(
      host.metadataFetch('https://other.example/api/music/search?source=netease&keyword=fixture'),
    ).rejects.toThrow(/^METADATA_TARGET_REJECTED$/)
    expect(f.request).toHaveBeenCalledOnce()
  })
})

describe('MappHost exclusive ownership and cleanup', () => {
  it('holds the single-host guard until close completes, disposes idempotently, then allows recreation', async () => {
    const f = fixture()
    const pending = deferred<void>()
    f.audio.dispose.mockReturnValueOnce(pending.promise)
    const host = f.make()
    f.joined()
    const sound = host.playbackSoundFactory.create(track, soundOptions)
    storageBackend.setItem('mt-theme', 'dark')
    expect(() => f.make()).toThrow(/^MAPP_HOST_ACTIVE$/)
    const closing = host.dispose()
    expect(host.dispose()).toBe(closing)
    expect(() => f.make()).toThrow(/^MAPP_HOST_ACTIVE$/)
    expect(() => host.playbackSoundFactory.create(track, soundOptions)).toThrow(/^MAPP_HOST_DISPOSED$/)
    await flush()
    expect(f.session.dispose).toHaveBeenCalledOnce()
    expect(sound.unload).toHaveBeenCalledOnce()
    expect(f.audio.dispose).toHaveBeenCalledOnce()
    expect(() => f.make()).toThrow(/^MAPP_HOST_ACTIVE$/)
    pending.resolve()
    await closing
    expect(storageBackend.getItem('mt-userId')).toBeNull()
    expect(storageBackend.getItem('mt-theme')).toBeNull()
    expect(() => f.make()).not.toThrow()
  })

  it('still clears memory and releases the guard when closing audio fails', async () => {
    const f = fixture()
    const host = f.make()
    f.joined()
    host.playbackSoundFactory.create(track, soundOptions)
    storageBackend.setItem('mt-theme', 'fixture')
    f.audio.dispose.mockRejectedValueOnce(new Error('private fixture'))
    const closing = host.dispose()
    await expect(closing).rejects.toThrow('private fixture')
    expect(host.dispose()).toBe(closing)
    expect(storageBackend.getItem('mt-userId')).toBeNull()
    expect(storageBackend.getItem('mt-theme')).toBeNull()
    expect(() => f.make()).not.toThrow()
  })

  it.each(['session', 'audio', 'metadata', 'commands'] as const)(
    'cleans up partial initialization at %s and releases ownership',
    async (stage) => {
      const f = fixture()
      mocks[stage].mockImplementationOnce(() => {
        throw new Error('https://private.invalid/fixture')
      })
      expect(() => f.make()).toThrow(/^MAPP_HOST_INIT_FAILED$/)
      await flush()
      expect(f.session.dispose).toHaveBeenCalledTimes(stage === 'session' ? 0 : 1)
      expect(f.audio.dispose).toHaveBeenCalledTimes(stage === 'session' || stage === 'audio' ? 0 : 1)
      expect(storageBackend.getItem('mt-userId')).toBeNull()
      expect(() => f.make()).not.toThrow()
    },
  )

  it('observes a failed initialization close rejection while retaining the guard through close', async () => {
    const f = fixture()
    const pending = deferred<void>()
    f.audio.dispose.mockReturnValueOnce(pending.promise)
    mocks.metadata.mockImplementationOnce(() => {
      throw new Error('private fixture')
    })
    expect(() => f.make()).toThrow(/^MAPP_HOST_INIT_FAILED$/)
    await flush()
    expect(() => f.make()).toThrow(/^MAPP_HOST_ACTIVE$/)
    pending.reject(new Error('private fixture close'))
    await flush()
    expect(() => f.make()).not.toThrow()
  })

  it.each(['network.websocket', 'user.read', 'network.request', 'audio.webAudio'])(
    'fails closed for denied/not-ready permission %s',
    async (permission) => {
      const f = fixture()
      f.has.mockImplementation((...args: unknown[]) => args[0] !== permission)
      expect(() => f.make()).toThrow(/^MAPP_HOST_INIT_FAILED$/)
      expect(mocks.session).not.toHaveBeenCalled()
      expect(mocks.audio).not.toHaveBeenCalled()
      expect(f.sdkConnect).not.toHaveBeenCalled()
      await flush()
      f.has.mockReturnValue(true)
      expect(() => f.make()).not.toThrow()
    },
  )

  it('sanitizes SDK unavailability without exposing errors or attempting fallback', async () => {
    const f = fixture()
    mocks.getSDK.mockImplementationOnce(() => {
      throw new Error('private SDK fixture detail')
    })
    expect(() => f.make()).toThrow(/^MAPP_HOST_INIT_FAILED$/)
    await flush()
    expect(() => f.make()).not.toThrow()
  })

  it.each([
    'ws://music.example/socket.io/?EIO=4&transport=websocket',
    'https://music.example/socket.io/?EIO=4&transport=websocket',
    'wss://name:fixture@music.example/socket.io/?EIO=4&transport=websocket',
    'wss://music.example:8443/socket.io/?EIO=4&transport=websocket',
    'wss://music.example/socket.io/?EIO=4&transport=websocket#fixture',
    'not a URL',
  ])('rejects unsafe reviewed socket origin %s before constructing adapters', async (reviewedEndpointUrl) => {
    const f = fixture()
    expect(() => f.make({ reviewedEndpointUrl })).toThrow(/^MAPP_HOST_INIT_FAILED$/)
    expect(mocks.getSDK).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.metadata).not.toHaveBeenCalled()
    await flush()
    expect(() => f.make()).not.toThrow()
  })

  it('derives a standard HTTPS origin from explicit wss:443 and delegates Engine.IO target validation', async () => {
    const f = fixture()
    const host = f.make({
      reviewedEndpointUrl: options.reviewedEndpointUrl.replace('music.example', 'music.example:443'),
    })
    expect(host.serverOrigin).toBe('https://music.example')
    await host.dispose()
    // Engine.IO validation belongs to RoomSession: forward its exact input and sanitize its rejection.
    mocks.session.mockImplementationOnce(() => {
      throw new Error('Unsupported SDK room transport target')
    })
    const reviewedEndpointUrl = 'wss://music.example/custom/socket.io/?EIO=3&transport=polling'
    expect(() => f.make({ reviewedEndpointUrl })).toThrow(/^MAPP_HOST_INIT_FAILED$/)
    expect(mocks.session).toHaveBeenLastCalledWith({
      ...options,
      reviewedEndpointUrl,
      timeoutMs: undefined,
      onChange: expect.any(Function),
    })
    expect(f.sdkConnect).not.toHaveBeenCalled()
  })
})
