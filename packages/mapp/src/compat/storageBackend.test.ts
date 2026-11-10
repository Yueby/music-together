// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageAdapter } from '../../../client/src/lib/StorageAdapter'

let storageBackend: StorageAdapter
let clearMemoryStorage: () => void
let nativeAccess: ReturnType<typeof vi.fn<() => Storage>>

beforeEach(async () => {
  // These are jsdom fixtures, never the user's browser storage.
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('mt-nickname', 'web-nickname-fixture')
  localStorage.setItem('mt-userId', 'web-canonical-fixture')
  localStorage.setItem('mt-auth-cookies', 'web-cookie-fixture')
  localStorage.setItem('mt-rejoin-token', 'web-token-fixture')
  sessionStorage.setItem('mt-nickname', 'session-nickname-fixture')

  nativeAccess = vi.fn<() => Storage>(() => {
    throw new Error('Native storage must not be accessed')
  })
  for (const target of new Set([globalThis, window])) {
    vi.spyOn(target, 'localStorage', 'get').mockImplementation(nativeAccess)
    vi.spyOn(target, 'sessionStorage', 'get').mockImplementation(nativeAccess)
  }
  vi.resetModules()
  const module = await import('./storageBackend')
  storageBackend = module.storageBackend
  clearMemoryStorage = module.clearMemoryStorage
})

afterEach(() => {
  clearMemoryStorage?.()
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  expect(nativeAccess).not.toHaveBeenCalled()
})

describe('Mapp memory storage backend', () => {
  it('imports and runs while native storage getters throw', async () => {
    const module = await import('./storageBackend')
    expect(module.default).toBe(storageBackend)
    storageBackend.setItem('mt-nickname', 'mapp-nickname-fixture')
    expect(storageBackend.getItem('mt-nickname')).toBe('mapp-nickname-fixture')
    storageBackend.removeItem('mt-nickname')
    expect(storageBackend.getItem('mt-nickname')).toBeNull()
    clearMemoryStorage()
    expect(nativeAccess).not.toHaveBeenCalled()
  })

  it.each([
    ['mt-nickname', 'nickname-fixture'],
    ['mt-userId', 'canonical-fixture'],
    ['mt-volume', '0.35'],
    ['mt-lyricAlignAnchor', 'center'],
    ['mt-lyricFontSize', '90'],
    ['mt-lyricEnableBlur', 'false'],
    ['mt-bgRenderer', 'mesh'],
    ['mt-bgStaticMode', 'true'],
    ['mt-ttmlEnabled', 'false'],
    ['mt-custom-setting', '{"fixture":true}'],
    ['mt-empty-setting', ''],
  ])('stores settings as unchanged strings: %s', (key, value) => {
    expect(storageBackend.getItem(key)).toBeNull()
    storageBackend.setItem(key, value)
    expect(storageBackend.getItem(key)).toBe(value)
    storageBackend.setItem(key, 'replacement-fixture')
    expect(storageBackend.getItem(key)).toBe('replacement-fixture')
    storageBackend.removeItem(key)
    expect(storageBackend.getItem(key)).toBeNull()
  })

  it.each(['mt-auth-cookies', 'mt-rejoin-token'])(
    'rejects reads, writes and removals of a sensitive key: %s',
    (key) => {
      storageBackend.setItem('mt-nickname', 'nickname-fixture')
      expect(storageBackend.getItem(key)).toBeNull()
      storageBackend.setItem(key, 'sensitive-fixture')
      expect(storageBackend.getItem(key)).toBeNull()
      storageBackend.setItem(key, 'replacement-fixture')
      storageBackend.removeItem(key)
      expect(storageBackend.getItem(key)).toBeNull()
      expect(storageBackend.getItem('mt-nickname')).toBe('nickname-fixture')
    },
  )

  it.each(['', 'nickname', 'userId', 'auth-cookies', 'rejoin-token', 'MT-nickname', 'xmt-nickname'])(
    'rejects all operations without the exact prefix: %s',
    (key) => {
      expect(storageBackend.getItem(key)).toBeNull()
      storageBackend.setItem(key, 'ignored-fixture')
      expect(storageBackend.getItem(key)).toBeNull()
      storageBackend.removeItem(key)
      expect(storageBackend.getItem(key)).toBeNull()
    },
  )

  it('shares one memory map between module consumers in this realm', async () => {
    const anotherConsumer = await import('./storageBackend')
    storageBackend.setItem('mt-nickname', 'shared-fixture')
    expect(anotherConsumer.default.getItem('mt-nickname')).toBe('shared-fixture')
    anotherConsumer.default.removeItem('mt-nickname')
    expect(storageBackend.getItem('mt-nickname')).toBeNull()
  })

  it('keeps Web and session data isolated and unchanged', () => {
    expect(storageBackend.getItem('mt-nickname')).toBeNull()
    expect(storageBackend.getItem('mt-userId')).toBeNull()
    storageBackend.setItem('mt-nickname', 'mapp-nickname-fixture')
    storageBackend.setItem('mt-userId', 'mapp-canonical-fixture')
    storageBackend.removeItem('mt-nickname')
    clearMemoryStorage()
    expect(nativeAccess).not.toHaveBeenCalled()

    vi.restoreAllMocks()
    expect(localStorage.getItem('mt-nickname')).toBe('web-nickname-fixture')
    expect(localStorage.getItem('mt-userId')).toBe('web-canonical-fixture')
    expect(localStorage.getItem('mt-auth-cookies')).toBe('web-cookie-fixture')
    expect(localStorage.getItem('mt-rejoin-token')).toBe('web-token-fixture')
    expect(sessionStorage.getItem('mt-nickname')).toBe('session-nickname-fixture')
  })

  it('leaves canonical identity empty until the host explicitly sets it', () => {
    expect(storageBackend.getItem('mt-userId')).toBeNull()
    storageBackend.setItem('mt-nickname', 'nickname-fixture')
    expect(storageBackend.getItem('mt-userId')).toBeNull()
    storageBackend.setItem('mt-userId', 'host-canonical-fixture')
    expect(storageBackend.getItem('mt-userId')).toBe('host-canonical-fixture')
  })

  it('clears every in-memory setting on unload and can be reused afterward', () => {
    const keys = ['mt-nickname', 'mt-userId', 'mt-volume', 'mt-lyricFontSize', 'mt-bgRenderer']
    for (const key of keys) storageBackend.setItem(key, 'setting-fixture')
    clearMemoryStorage()
    clearMemoryStorage()
    for (const key of keys) expect(storageBackend.getItem(key)).toBeNull()
    storageBackend.setItem('mt-nickname', 'new-lifecycle-fixture')
    expect(storageBackend.getItem('mt-nickname')).toBe('new-lifecycle-fixture')
  })
})
