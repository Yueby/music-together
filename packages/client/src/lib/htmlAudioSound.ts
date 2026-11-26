import type { PlaybackSound, PlaybackSoundOptions } from './PlaybackSound'

const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='

/** Two pooled elements let the active track and next-track preload ping-pong without losing mobile gesture unlock. */
const AUDIO_POOL_SIZE = 2

const UNLOCK_EVENTS: ReadonlyArray<keyof DocumentEventMap> = ['touchend', 'click', 'keydown']

type MediaElementWithPitch = HTMLAudioElement & {
  preservesPitch?: boolean
  mozPreservesPitch?: boolean
  webkitPreservesPitch?: boolean
}

const pool: HTMLAudioElement[] = []
/** Elements attached to MediaElementAudioSourceNode stay WebAudio-routed forever and must not be reused for cross-origin streams. */
const taintedElements = new WeakSet<HTMLAudioElement>()
const unlockWaiters = new Set<() => void>()

let unlocked = false
let nextSoundId = 0
let gestureListenersAttached = false

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1, value))
}

function enablePreservesPitch(element: HTMLAudioElement): void {
  const media = element as MediaElementWithPitch
  if ('preservesPitch' in media) media.preservesPitch = true
  if ('mozPreservesPitch' in media) media.mozPreservesPitch = true
  if ('webkitPreservesPitch' in media) media.webkitPreservesPitch = true
}

function createMediaElement(): HTMLAudioElement {
  const element = new Audio()
  enablePreservesPitch(element)
  return element
}

function resetMediaElement(element: HTMLAudioElement): void {
  try {
    element.pause()
  } catch {
    /* ignore */
  }
  element.removeAttribute('src')
  try {
    element.load()
  } catch {
    /* ignore */
  }
  element.volume = 1
  element.muted = false
  element.playbackRate = 1
  element.defaultPlaybackRate = 1
  enablePreservesPitch(element)
}

function acquireMediaElement(): HTMLAudioElement {
  while (pool.length > 0) {
    const candidate = pool.pop()!
    if (!taintedElements.has(candidate)) {
      enablePreservesPitch(candidate)
      return candidate
    }
  }
  return createMediaElement()
}

function releaseMediaElement(element: HTMLAudioElement): void {
  resetMediaElement(element)
  if (!taintedElements.has(element) && pool.length < AUDIO_POOL_SIZE) {
    pool.push(element)
  }
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

function flushUnlockWaiters(): void {
  const waiters = [...unlockWaiters]
  unlockWaiters.clear()
  detachGestureListeners()
  for (const waiter of waiters) waiter()
}

function onUserGesture(): void {
  // Run both pool priming and active sound unlock listeners synchronously inside the user gesture stack.
  void unlockHtmlAudioPool()
  flushUnlockWaiters()
}

function attachGestureListeners(): void {
  if (gestureListenersAttached || typeof document === 'undefined') return
  gestureListenersAttached = true
  for (const eventName of UNLOCK_EVENTS) {
    document.addEventListener(eventName, onUserGesture, true)
  }
}

function detachGestureListeners(): void {
  if (!gestureListenersAttached || typeof document === 'undefined') return
  gestureListenersAttached = false
  for (const eventName of UNLOCK_EVENTS) {
    document.removeEventListener(eventName, onUserGesture, true)
  }
}

function primeElement(element: HTMLAudioElement): Promise<boolean> {
  element.muted = true
  element.volume = 0
  element.src = SILENT_WAV_DATA_URI
  try {
    return Promise.resolve(element.play()).then(
      () => {
        resetMediaElement(element)
        return true
      },
      () => {
        resetMediaElement(element)
        return false
      },
    )
  } catch {
    resetMediaElement(element)
    return Promise.resolve(false)
  }
}

export function isHtmlAudioPoolUnlocked(): boolean {
  return unlocked
}

/**
 * Prime pooled HTMLAudioElements within a real user gesture (click / touchend / keydown)
 * so both active playback and next-track preload stay unlocked across song switches.
 */
export async function unlockHtmlAudioPool(): Promise<void> {
  if (unlocked) {
    if (unlockWaiters.size > 0) flushUnlockWaiters()
    return
  }
  if (typeof Audio === 'undefined') {
    unlocked = true
    return
  }

  while (pool.length < AUDIO_POOL_SIZE) {
    pool.push(createMediaElement())
  }
  // Claim elements synchronously while still inside the user gesture call stack.
  const toPrime = pool.splice(0, AUDIO_POOL_SIZE)
  const results = await Promise.all(toPrime.map((element) => primeElement(element)))
  for (const element of toPrime) {
    if (!taintedElements.has(element) && pool.length < AUDIO_POOL_SIZE) {
      pool.push(element)
    }
  }
  if (results.some(Boolean)) {
    unlocked = true
  }
}

/** Test-only reset for clean module isolation across Vitest specs. */
export function resetHtmlAudioPoolForTests(): void {
  detachGestureListeners()
  unlockWaiters.clear()
  while (pool.length > 0) {
    resetMediaElement(pool.pop()!)
  }
  unlocked = false
  nextSoundId = 0
}

export function createHtmlAudioSound(options: PlaybackSoundOptions): PlaybackSound {
  const id = ++nextSoundId
  const src = options.src.find((candidate) => typeof candidate === 'string' && candidate.length > 0)

  let state: 'unloaded' | 'loading' | 'loaded' = 'loading'
  let isPlaying = false
  let playOp = 0
  let storedRate = 1
  let pendingSeek: number | undefined
  let internalPause = false
  let internalPlay = false
  let playListeners: Array<(soundId: number) => void> = []
  let unlockListeners: Array<(soundId: number) => void> = []

  const element = src && typeof Audio !== 'undefined' ? acquireMediaElement() : null
  const isUnloaded = () => state === 'unloaded'

  const onUnlockSignal = () => {
    if (isUnloaded()) return
    const listeners = unlockListeners
    unlockListeners = []
    for (const listener of listeners) {
      if (isUnloaded()) break
      listener(id)
    }
  }

  const flushPlayListeners = (op: number) => {
    const listeners = playListeners
    playListeners = []
    for (const listener of listeners) {
      if (isUnloaded() || playOp !== op) break
      listener(id)
    }
  }

  const reportProgress = () => {
    if (!element || state !== 'loading' || !options.onprogress) return
    const { buffered, duration } = element
    if (buffered.length > 0 && Number.isFinite(duration) && duration > 0) {
      const ratio = Math.max(0, Math.min(1, buffered.end(buffered.length - 1) / duration))
      options.onprogress({ phase: 'buffering', progress: ratio })
    }
  }

  const handleLoaded = () => {
    if (!element || state !== 'loading') return
    if (pendingSeek !== undefined) {
      const target = pendingSeek
      pendingSeek = undefined
      try {
        element.currentTime = target
      } catch {
        /* ignore invalid seek range */
      }
    }
    state = 'loaded'
    options.onload?.()
    if (options.autoplay && state === 'loaded') {
      handle.play(id)
    }
  }

  const handleError = () => {
    if (!element || state !== 'loading') return
    const mediaError = element.error ?? new Error('MEDIA_LOAD_ERROR')
    cleanupListeners()
    state = 'unloaded'
    isPlaying = false
    pendingSeek = undefined
    playListeners = []
    unlockListeners = []
    unlockWaiters.delete(onUnlockSignal)
    if (unlockWaiters.size === 0) detachGestureListeners()
    releaseMediaElement(element)
    options.onloaderror?.(id, mediaError)
  }

  const handleEnded = () => {
    if (state === 'unloaded') return
    isPlaying = false
    playListeners = []
    options.onend?.()
  }

  const handleNativePause = () => {
    if (!element || state === 'unloaded' || internalPause || element.ended) return
    if (!isPlaying) return
    isPlaying = false
    playListeners = []
    options.onpause?.()
  }

  const handleNativePlay = () => {
    if (!element || state === 'unloaded' || internalPlay || isPlaying) return
    isPlaying = true
    options.onplay?.()
  }

  const cleanupListeners = () => {
    if (!element) return
    element.removeEventListener('canplay', handleLoaded)
    element.removeEventListener('canplaythrough', handleLoaded)
    element.removeEventListener('progress', reportProgress)
    element.removeEventListener('loadedmetadata', reportProgress)
    element.removeEventListener('error', handleError)
    element.removeEventListener('ended', handleEnded)
    element.removeEventListener('pause', handleNativePause)
    element.removeEventListener('play', handleNativePlay)
  }

  const matches = (soundId?: number) => state !== 'unloaded' && (soundId === undefined || soundId === id)

  function rate(): number
  function rate(value: number): PlaybackSound
  function rate(value?: number): number | PlaybackSound {
    if (value === undefined) return element && state !== 'unloaded' ? element.playbackRate : storedRate
    if (element && state !== 'unloaded' && Number.isFinite(value) && value > 0) {
      storedRate = value
      enablePreservesPitch(element)
      element.playbackRate = value
    }
    return handle
  }

  const handle: PlaybackSound = {
    supportsPitchPreservingRate: true,
    state: () => state,
    duration: () => {
      if (!element || state === 'unloaded') return 0
      const d = element.duration
      return Number.isFinite(d) && d > 0 ? d : 0
    },
    playing: (soundId) => matches(soundId) && isPlaying,
    seek: (position, soundId) => {
      if (!matches(soundId) || !element) return position === undefined ? 0 : handle
      if (position === undefined) {
        if (state === 'loading' && pendingSeek !== undefined) return pendingSeek
        return Number.isFinite(element.currentTime) ? element.currentTime : 0
      }
      const safeTarget = Math.max(0, Number.isFinite(position) ? position : 0)
      if (state === 'loading') {
        pendingSeek = safeTarget
        if (element.readyState >= 1) {
          try {
            element.currentTime = safeTarget
          } catch {
            /* apply on canplay */
          }
        }
        return handle
      }
      try {
        element.currentTime = safeTarget
      } catch {
        /* ignore out-of-range seek before metadata settles */
      }
      return handle
    },
    play: (soundId) => {
      if (!matches(soundId) || !element) return id
      const op = ++playOp
      isPlaying = true
      element.muted = false
      internalPlay = true
      let playPromise: Promise<unknown>
      try {
        playPromise = Promise.resolve(element.play())
      } catch (error) {
        playPromise = Promise.reject(error)
      } finally {
        internalPlay = false
      }
      playPromise.then(
        () => {
          if (state === 'unloaded' || playOp !== op) return
          isPlaying = true
          unlocked = true
          options.onplay?.()
          flushPlayListeners(op)
        },
        (error: unknown) => {
          if (state === 'unloaded' || playOp !== op || isAbortError(error)) return
          isPlaying = false
          playListeners = []
          options.onplayerror?.(id, error)
        },
      )
      return id
    },
    pause: (soundId) => {
      if (!matches(soundId) || !element) return handle
      ++playOp
      playListeners = []
      const wasPlaying = isPlaying
      isPlaying = false
      internalPause = true
      try {
        element.pause()
      } catch {
        /* ignore */
      } finally {
        internalPause = false
      }
      if (wasPlaying || state === 'loaded') {
        options.onpause?.()
      }
      return handle
    },
    rate,
    volume: (value) => {
      if (element && state !== 'unloaded') {
        element.volume = clampVolume(value)
      }
      return handle
    },
    once: (event, listener) => {
      if (state === 'unloaded') return handle
      if (event === 'play') {
        playListeners.push(listener)
      } else {
        unlockListeners.push(listener)
        unlockWaiters.add(onUnlockSignal)
        attachGestureListeners()
      }
      return handle
    },
    load: () => handle,
    unload: () => {
      if (state === 'unloaded') return handle
      ++playOp
      state = 'unloaded'
      isPlaying = false
      pendingSeek = undefined
      playListeners = []
      unlockListeners = []
      unlockWaiters.delete(onUnlockSignal)
      if (unlockWaiters.size === 0) detachGestureListeners()
      if (element) {
        cleanupListeners()
        releaseMediaElement(element)
      }
      return handle
    },
    claimMediaElementForAnalysis: () => {
      if (!element || state === 'unloaded') return null
      taintedElements.add(element)
      return element
    },
  }

  if (!element || !src) {
    state = 'unloaded'
    queueMicrotask(() => {
      options.onloaderror?.(id, new Error('INVALID_AUDIO_SOURCE'))
    })
    return handle
  }

  element.preload = options.preload === false ? 'none' : 'auto'
  element.volume = clampVolume(options.volume ?? 1)
  element.muted = false
  element.playbackRate = 1
  element.defaultPlaybackRate = 1
  enablePreservesPitch(element)

  element.addEventListener('canplay', handleLoaded)
  element.addEventListener('canplaythrough', handleLoaded)
  element.addEventListener('progress', reportProgress)
  element.addEventListener('loadedmetadata', reportProgress)
  element.addEventListener('error', handleError)
  element.addEventListener('ended', handleEnded)
  element.addEventListener('pause', handleNativePause)
  element.addEventListener('play', handleNativePlay)

  element.src = src
  try {
    element.load()
  } catch {
    /* ignore */
  }

  return handle
}
