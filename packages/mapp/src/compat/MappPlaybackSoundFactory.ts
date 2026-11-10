import type { MiniAppSDK } from '@discourse-mini-app/sdk'
import type {
  PlaybackSound,
  PlaybackSoundFactory,
  PlaybackSoundOptions,
} from '../../../client/src/lib/PlaybackSound.ts'
import { MappAudioEngine, type MappAudioEngineSnapshot } from './MappAudioEngine.ts'

export interface MappPlaybackSoundFactoryOptions {
  sdk: MiniAppSDK
  getRoomId: () => string | null
  mode?: 'bytes' | 'stream'
  createContext?: () => AudioContext
}

export interface MappPlaybackSoundFactory extends PlaybackSoundFactory {
  unlock(): Promise<boolean>
  dispose(): Promise<void>
}

type Callbacks = Pick<PlaybackSoundOptions, 'onload' | 'onloaderror' | 'onplay' | 'onplayerror' | 'onpause' | 'onend'>
type Listener = (soundId: number) => void

interface Owner {
  id: number
  state: ReturnType<PlaybackSound['state']>
  retired: boolean
  operation: number
  callbacks: Callbacks
  playListeners: Listener[]
  unlockListeners: Listener[]
  hasPlayed: boolean
  endEligible: boolean
  ended: boolean
  endQueued: boolean
  changing: boolean
  pendingSeek?: number
}

/** One engine/context per factory; handles own callbacks, never transports or audio clocks. */
export function createMappPlaybackSoundFactory(options: MappPlaybackSoundFactoryOptions): MappPlaybackSoundFactory {
  let owner: Owner | null = null
  let nextId = 0
  let disposed = false
  let disposal: Promise<void> | null = null

  const current = (entry: Owner) => !disposed && owner === entry && !entry.retired
  const valid = (entry: Owner, operation: number) => current(entry) && entry.operation === operation
  const cancelPlay = (entry: Owner) => {
    ++entry.operation
    entry.playListeners = []
    entry.endEligible = false
    entry.endQueued = false
  }
  const retire = (entry: Owner) => {
    cancelPlay(entry)
    entry.state = 'unloaded'
    entry.retired = true
    entry.unlockListeners = []
    entry.callbacks = {}
  }
  const enqueue = (entry: Owner, operation: number, callback: () => void) => {
    queueMicrotask(() => {
      if (valid(entry, operation)) callback()
    })
  }

  const engine = new MappAudioEngine({
    sdk: options.sdk,
    createContext: options.createContext,
    onChange(snapshot: MappAudioEngineSnapshot) {
      const entry = owner
      if (
        !entry ||
        !current(entry) ||
        entry.state !== 'loaded' ||
        entry.changing ||
        !entry.hasPlayed ||
        !entry.endEligible ||
        entry.ended ||
        entry.endQueued ||
        snapshot.audio.status !== 'ended'
      )
        return
      const operation = entry.operation
      entry.endQueued = true
      enqueue(entry, operation, () => {
        entry.endQueued = false
        if (!entry.endEligible || entry.ended || engine.snapshot().audio.status !== 'ended') return
        entry.ended = true
        entry.endEligible = false
        entry.callbacks.onend?.()
      })
    },
  })

  return {
    allowLoadRetry: false,
    supportsHtml5Analysis: false,
    create(track, soundOptions) {
      if (owner) {
        retire(owner)
        owner = null
        engine.unload()
      }
      const entry: Owner = {
        id: ++nextId,
        state: disposed ? 'unloaded' : 'loading',
        retired: disposed,
        operation: 0,
        // Never retain source URLs or unrelated provider metadata on a handle.
        callbacks: disposed
          ? {}
          : {
              onload: soundOptions.onload,
              onloaderror: soundOptions.onloaderror,
              onplay: soundOptions.onplay,
              onplayerror: soundOptions.onplayerror,
              onpause: soundOptions.onpause,
              onend: soundOptions.onend,
            },
        playListeners: [],
        unlockListeners: [],
        hasPlayed: false,
        endEligible: false,
        ended: false,
        endQueued: false,
        changing: false,
      }
      const matches = (id?: number) => current(entry) && (id === undefined || id === entry.id)
      const playError = (operation: number) =>
        enqueue(entry, operation, () => {
          entry.endEligible = false
          entry.playListeners = []
          entry.callbacks.onplayerror?.(entry.id, 'AUDIO_PLAY_FAILED')
        })
      function rate(): number
      function rate(value: number): PlaybackSound
      function rate(value?: number): number | PlaybackSound {
        if (value === undefined) return current(entry) ? engine.getPlaybackRate() : 1
        if (current(entry)) engine.setPlaybackRate(value)
        return handle
      }
      const handle: PlaybackSound = {
        state: () => entry.state,
        duration: () => (current(entry) && entry.state === 'loaded' ? engine.snapshot().audio.duration : 0),
        playing(id) {
          if (!matches(id) || entry.state !== 'loaded') return false
          const status = engine.snapshot().audio.status
          return status === 'playing' || status === 'scheduled'
        },
        seek(position, id) {
          if (!matches(id)) return position === undefined ? 0 : handle
          if (position === undefined) return entry.pendingSeek ?? engine.snapshot().audio.position
          if (entry.state === 'loading') {
            cancelPlay(entry)
            entry.pendingSeek = Math.max(0, position)
            return handle
          }
          if (entry.state !== 'loaded') return handle
          const wasActive = handle.playing(id)
          cancelPlay(entry)
          entry.changing = true
          try {
            engine.seek(position)
          } finally {
            entry.changing = false
          }
          entry.endEligible = wasActive && engine.snapshot().audio.status !== 'ended'
          return handle
        },
        play(id) {
          if (!matches(id)) return entry.id
          // A repeated play replaces the operation, while retaining listeners for this next start.
          const operation = ++entry.operation
          entry.endQueued = false
          entry.ended = false
          entry.hasPlayed = true
          entry.endEligible = entry.state === 'loaded'
          engine.play().then(
            (played) => {
              if (!valid(entry, operation)) return
              if (!played) {
                playError(operation)
                return
              }
              enqueue(entry, operation, () => {
                const listeners = entry.playListeners
                entry.playListeners = []
                entry.callbacks.onplay?.()
                for (const listener of listeners) {
                  if (!valid(entry, operation)) break
                  listener(entry.id)
                }
              })
            },
            () => playError(operation),
          )
          return entry.id
        },
        pause(id) {
          if (!matches(id)) return handle
          cancelPlay(entry)
          if (entry.state === 'loaded') engine.pause()
          // Always reported, like Howler's `pause` event. The shared hooks seek right after pausing, and that
          // seek bumps the operation counter; it must not swallow this callback, or the UI keeps showing "playing".
          queueMicrotask(() => {
            if (current(entry)) entry.callbacks.onpause?.()
          })
          return handle
        },
        rate,
        volume(value) {
          if (current(entry)) engine.setVolume(value)
          return handle
        },
        once(event, listener) {
          if (current(entry)) {
            if (event === 'play') entry.playListeners.push(listener)
            else entry.unlockListeners.push(listener)
          }
          return handle
        },
        load: () => handle,
        unload() {
          if (current(entry)) {
            retire(entry)
            owner = null
            engine.unload()
          }
          return handle
        },
      }
      if (disposed) return handle
      owner = entry
      const loadFailed = () => {
        if (!current(entry)) return
        entry.state = 'unloaded'
        // Failure is terminal for loading; load() never retries the source.
        queueMicrotask(() => {
          if (current(entry) && entry.state === 'unloaded') {
            entry.callbacks.onloaderror?.(entry.id, 'AUDIO_LOAD_FAILED')
          }
        })
      }
      try {
        engine.setPlaybackRate(1)
        engine.setVolume(soundOptions.volume ?? 0.12)
        const roomId = options.getRoomId()
        if (roomId === null) throw new Error('AUDIO_LOAD_FAILED')
        engine.loadRoomTrack({ roomId, trackId: track.id, mode: options.mode ?? 'stream' }).then((loaded) => {
          if (!current(entry)) return
          if (!loaded) {
            loadFailed()
            return
          }
          try {
            if (entry.pendingSeek !== undefined) engine.seek(entry.pendingSeek)
            entry.pendingSeek = undefined
          } catch {
            loadFailed()
            return
          }
          entry.state = 'loaded'
          // Loading belongs to the handle, not to an individual play/seek operation.
          queueMicrotask(() => {
            if (current(entry) && entry.state === 'loaded') entry.callbacks.onload?.()
          })
        }, loadFailed)
      } catch {
        // Even synchronous permission/input errors cannot call back during create().
        queueMicrotask(loadFailed)
      }
      return handle
    },
    unlock() {
      if (disposed) return Promise.resolve(false)
      const entry = owner
      const operation = entry?.operation
      // Deliberately call before any await: context.resume must keep the user gesture.
      return engine.unlock().then(
        (unlocked) => {
          if (disposed) return false
          if (unlocked && entry && operation !== undefined) {
            enqueue(entry, operation, () => {
              const listeners = entry.unlockListeners
              entry.unlockListeners = []
              for (const listener of listeners) {
                if (!valid(entry, operation)) break
                listener(entry.id)
              }
            })
          }
          return unlocked
        },
        () => false,
      )
    },
    dispose() {
      if (disposal) return disposal
      disposed = true
      if (owner) retire(owner)
      owner = null
      disposal = engine.dispose()
      return disposal
    },
  }
}
