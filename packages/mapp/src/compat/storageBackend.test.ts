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

  it('never accepts the rejoin ticket, in memory or anywhere else', () => {
    storageBackend.setItem('mt-nickname', 'nickname-fixture')
    expect(storageBackend.getItem('mt-rejoin-token')).toBeNull()
    storageBackend.setItem('mt-rejoin-token', 'sensitive-fixture')
    expect(storageBackend.getItem('mt-rejoin-token')).toBeNull()
    storageBackend.removeItem('mt-rejoin-token')
    expect(storageBackend.getItem('mt-nickname')).toBe('nickname-fixture')
  })

  describe('SDK preference persistence', () => {
    function store(initial: Record<string, string> = {}) {
      const data = new Map(Object.entries(initial))
      return {
        data,
        getItem: vi.fn(async (key: string) => data.get(key) ?? null),
        setItem: vi.fn(async (key: string, value: string) => void data.set(key, value)),
        removeItem: vi.fn(async (key: string) => void data.delete(key)),
      }
    }

    it('works as plain memory until the SDK store is attached', () => {
      storageBackend.setItem('mt-auth-cookies', '[{"platform":"netease"}]')
      expect(storageBackend.getItem('mt-auth-cookies')).toBe('[{"platform":"netease"}]')
    })

    it('falls back to restoring saved logins when snapshot export is unavailable', async () => {
      const sdk = store({ 'mt-auth-cookies': '[{"platform":"qq"}]', 'mt-nickname': 'never-read' })
      const module = await import('./storageBackend')
      await module.hydratePersistentStorage(sdk)
      expect(storageBackend.getItem('mt-auth-cookies')).toBe('[{"platform":"qq"}]')
      expect(sdk.getItem).toHaveBeenCalledExactlyOnceWith('mt-auth-cookies')
      expect(storageBackend.getItem('mt-nickname')).toBeNull()
      storageBackend.setItem('mt-auth-cookies', '[]')
      expect(sdk.setItem).toHaveBeenCalledExactlyOnceWith('mt-auth-cookies', '[]')
      storageBackend.removeItem('mt-auth-cookies')
      expect(sdk.removeItem).toHaveBeenCalledExactlyOnceWith('mt-auth-cookies')
    })

    it('restores valid preferences and writes changes through without persisting canonical identity or rejoin tickets', async () => {
      const sdk = store()
      const entries = [
        ['mt-auth-cookies', 'saved-login'],
        ['mt-nickname', 'saved-nickname'],
        ['mt-volume', '0.35'],
        ['mt-lyricFontSize', '90'],
        ['mt-bgRenderer', 'mesh'],
        ['mt-ttmlEnabled', 'false'],
        ['mt-empty-setting', ''],
      ]
      const exportData = vi.fn(async () => ({
        format: 1,
        entries: [
          ...entries,
          ['mt-userId', 'stale-id'],
          ['mt-rejoin-token', 'stale-ticket'],
          ['outside-app', 'ignore'],
          ['mt-invalid', 42],
          ['mt-incomplete'],
          ['mt-extra', 'value', 'extra'],
          null,
        ],
      }))
      const module = await import('./storageBackend')
      storageBackend.setItem('mt-nickname', 'current-nickname')
      await module.hydratePersistentStorage({ ...sdk, exportData })

      for (const [key, value] of entries) {
        expect(storageBackend.getItem(key)).toBe(key === 'mt-nickname' ? 'current-nickname' : value)
      }
      expect(sdk.getItem).not.toHaveBeenCalled()
      for (const key of ['mt-userId', 'mt-rejoin-token', 'outside-app', 'mt-invalid', 'mt-incomplete', 'mt-extra']) {
        expect(storageBackend.getItem(key)).toBeNull()
      }

      storageBackend.setItem('mt-userId', 'current-id')
      expect(storageBackend.getItem('mt-userId')).toBe('current-id')
      storageBackend.removeItem('mt-userId')
      expect(storageBackend.getItem('mt-userId')).toBeNull()
      storageBackend.setItem('mt-rejoin-token', 'new-ticket')
      expect(storageBackend.getItem('mt-rejoin-token')).toBeNull()
      storageBackend.removeItem('mt-rejoin-token')
      storageBackend.setItem('mt-volume', '0.5')
      storageBackend.removeItem('mt-bgRenderer')
      expect(sdk.setItem).toHaveBeenCalledExactlyOnceWith('mt-volume', '0.5')
      expect(sdk.removeItem).toHaveBeenCalledExactlyOnceWith('mt-bgRenderer')
    })

    it.each([
      () => Promise.reject(new Error('export unavailable')),
      async () => ({ format: 2, entries: [] }),
      async () => ({ format: 1, entries: {} }),
    ])('falls back to the saved login if export fails or the snapshot is malformed', async (exportData) => {
      const sdk = store({ 'mt-auth-cookies': 'saved' })
      const module = await import('./storageBackend')
      await module.hydratePersistentStorage({ ...sdk, exportData })
      expect(sdk.getItem).toHaveBeenCalledExactlyOnceWith('mt-auth-cookies')
      expect(storageBackend.getItem('mt-auth-cookies')).toBe('saved')
    })

    it('ignores a pending snapshot after memory is cleared', async () => {
      const sdk = store()
      let resolveSnapshot!: (value: { format: number; entries: [string, string][] }) => void
      const snapshot = new Promise<{ format: number; entries: [string, string][] }>((resolve) => {
        resolveSnapshot = resolve
      })
      const module = await import('./storageBackend')
      const hydrate = module.hydratePersistentStorage({ ...sdk, exportData: () => snapshot })
      clearMemoryStorage()
      resolveSnapshot({ format: 1, entries: [['mt-volume', '0.35']] })
      await hydrate

      expect(storageBackend.getItem('mt-volume')).toBeNull()
      storageBackend.setItem('mt-volume', '0.5')
      expect(sdk.setItem).not.toHaveBeenCalled()
    })

    it('does not let a failing SDK store break reads or writes', async () => {
      const sdk = store()
      sdk.getItem.mockRejectedValue(new Error('IndexedDB unavailable'))
      sdk.setItem.mockRejectedValue(new Error('quota'))
      const module = await import('./storageBackend')
      await expect(module.hydratePersistentStorage(sdk)).resolves.toBeUndefined()
      expect(() => storageBackend.setItem('mt-auth-cookies', 'x')).not.toThrow()
      expect(storageBackend.getItem('mt-auth-cookies')).toBe('x')
    })

    it('stops writing through on unload and keeps the saved copy', async () => {
      const sdk = store({ 'mt-auth-cookies': 'saved' })
      const module = await import('./storageBackend')
      await module.hydratePersistentStorage(sdk)
      clearMemoryStorage()
      expect(storageBackend.getItem('mt-auth-cookies')).toBeNull()
      storageBackend.setItem('mt-auth-cookies', 'after-unload')
      expect(sdk.setItem).not.toHaveBeenCalled()
      expect(sdk.removeItem).not.toHaveBeenCalled()
      expect(sdk.data.get('mt-auth-cookies')).toBe('saved')
    })

    it('never touches native storage', async () => {
      const module = await import('./storageBackend')
      await module.hydratePersistentStorage(store({ 'mt-auth-cookies': 'saved' }))
      storageBackend.setItem('mt-auth-cookies', 'next')
      expect(nativeAccess).not.toHaveBeenCalled()
    })
  })

  it.each(['', 'nickname', 'userId', 'auth-cookies', 'rejoin-token', 'MT-nickname', 'xmt-nickname', 'mt'])(
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
