import '../cspValidation.ts'
import { getSDK } from '@discourse-mini-app/sdk'
import type { MetadataFetch } from '../../../client/src/lib/MetadataTransport.ts'
import type { PlaybackSound, PlaybackSoundFactory } from '../../../client/src/lib/PlaybackSound.ts'
import type { RoomCommands } from '../../../client/src/lib/RoomCommands.ts'
import type { RoomCheckReader } from '../../../client/src/lib/RoomCheckReader.ts'
import { createMappPlaybackSoundFactory } from './MappPlaybackSoundFactory.ts'
import { createMappRoomCommands } from './MappRoomCommands.ts'
import { createMappRoomSession, type MappRoomSession, type MappRoomSessionSnapshot } from './RoomSession.ts'
import { createMappMetadataFetch } from './metadataFetch.ts'
import { clearMemoryStorage, storageBackend } from './storageBackend.ts'
import { createMappRoomCheck } from './roomCheck.ts'

export interface MappHostOptions {
  endpoint: string
  reviewedEndpointUrl: string
  timeoutMs?: number
  mediaMode?: 'bytes' | 'stream'
  createAudioContext?: () => AudioContext
  onSessionChange?: (snapshot: MappRoomSessionSnapshot) => void
}

export interface MappHost {
  readonly serverOrigin: string
  readonly session: MappRoomSession
  readonly playbackSoundFactory: PlaybackSoundFactory
  readonly roomCommands: RoomCommands
  readonly metadataFetch: MetadataFetch
  readonly roomCheck: RoomCheckReader
  isAudioUnlocked(): boolean
  unlockAudio(): Promise<void>
  connect(): void
  dispose(): Promise<void>
}

const REQUIRED_PERMISSIONS = ['network.websocket', 'user.read', 'network.request', 'audio.webAudio'] as const

// The memory storage backend is module-scoped, so its owner must be module-scoped too.
let activeHost = false

/** The reviewed Socket.IO WSS URL and the HTTP metadata origin share one host. */
function serverOriginFromSocket(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'wss:' || url.username || url.password || url.port || url.hash) {
    throw new Error('MAPP_HOST_CONFIG_REJECTED')
  }
  return `https://${url.host}`
}

/** Caller awaits getSDK().ready first. Construction never opens a connection or audio context. */
export function createMappHost(options: MappHostOptions): MappHost {
  if (activeHost) throw new Error('MAPP_HOST_ACTIVE')
  activeHost = true
  let disposed = false
  let unlocked = false
  let disposal: Promise<void> | undefined
  let session: MappRoomSession | undefined
  let audioFactory: ReturnType<typeof createMappPlaybackSoundFactory> | undefined
  let currentSound: PlaybackSound | undefined
  let previous: MappRoomSessionSnapshot | undefined
  /** Aborts in-flight metadata requests and room pre-checks on dispose. */
  const lifetime = new AbortController()

  function unloadCurrent(): void {
    const sound = currentSound
    currentSound = undefined
    sound?.unload()
  }

  function onChange(snapshot: MappRoomSessionSnapshot): void {
    if (disposed) return
    if (snapshot.userId === null) storageBackend.removeItem('mt-userId')
    else storageBackend.setItem('mt-userId', snapshot.userId)
    // Media belongs to one confirmed identity+room; unload it whenever that boundary moves.
    const boundaryChanged =
      !snapshot.connected ||
      snapshot.userId === null ||
      snapshot.roomId === null ||
      previous?.userId !== snapshot.userId ||
      previous?.roomId !== snapshot.roomId
    previous = snapshot
    if (boundaryChanged) unloadCurrent()
    options.onSessionChange?.(snapshot)
  }

  function dispose(): Promise<void> {
    // Install the shared promise before cleanup can re-enter via a session observer.
    disposal ??= (async () => {
      disposed = true
      unlocked = false
      lifetime.abort()
      try {
        session?.dispose()
        unloadCurrent()
        await audioFactory?.dispose()
      } finally {
        clearMemoryStorage()
        activeHost = false
      }
    })()
    return disposal
  }

  try {
    const serverOrigin = serverOriginFromSocket(options.reviewedEndpointUrl)
    // Before SDK readiness these are false. Never use native transport/storage as a fallback.
    const sdk = getSDK()
    if (!REQUIRED_PERMISSIONS.every((permission) => sdk.permissions.has(permission))) throw new Error()

    const roomSession = createMappRoomSession({
      endpoint: options.endpoint,
      reviewedEndpointUrl: options.reviewedEndpointUrl,
      timeoutMs: options.timeoutMs,
      onChange,
    })
    session = roomSession
    onChange(roomSession.snapshot)
    const audio = createMappPlaybackSoundFactory({
      sdk,
      getRoomId: () => (disposed ? null : roomSession.snapshot.roomId),
      mode: options.mediaMode,
      createContext: options.createAudioContext,
    })
    audioFactory = audio
    const metadata = createMappMetadataFetch({ sdk, reviewedOrigin: serverOrigin })

    return Object.freeze<MappHost>({
      serverOrigin,
      session: roomSession,
      roomCommands: createMappRoomCommands(roomSession),
      metadataFetch: (input, init) => {
        if (lifetime.signal.aborted) return Promise.reject(new DOMException('METADATA_CANCELLED', 'AbortError'))
        const signal = init?.signal ? AbortSignal.any([init.signal, lifetime.signal]) : lifetime.signal
        return metadata(input, { ...init, signal })
      },
      roomCheck: createMappRoomCheck(roomSession, lifetime.signal),
      playbackSoundFactory: {
        allowLoadRetry: audio.allowLoadRetry,
        supportsHtml5Analysis: audio.supportsHtml5Analysis,
        create(track, soundOptions) {
          if (disposed) throw new Error('MAPP_HOST_DISPOSED')
          currentSound = audio.create(track, soundOptions)
          return currentSound
        },
      },
      isAudioUnlocked: () => !disposed && unlocked,
      async unlockAudio() {
        if (disposed) throw new Error('MAPP_AUDIO_UNLOCK_FAILED')
        // unlock() must run synchronously in the caller's gesture, before the first await.
        const result = await audio.unlock().catch(() => false)
        if (!result || disposed) throw new Error('MAPP_AUDIO_UNLOCK_FAILED')
        unlocked = true
      },
      connect() {
        if (!disposed) roomSession.connect()
      },
      dispose,
    })
  } catch {
    // The synchronous constructor cannot await close; retain ownership until close finishes.
    void dispose().catch(() => {})
    throw new Error('MAPP_HOST_INIT_FAILED')
  }
}
