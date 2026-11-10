// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import storageBackend, { storageBackend as namedStorageBackend } from './storageBackend'
import { SETTING_DEFAULTS, storage } from './storage'

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('browser storage backend', () => {
  it('exports the same adapter as the default and named export', () => {
    expect(storageBackend).toBe(namedStorageBackend)
  })

  it('does not access localStorage while importing the backend or public storage', async () => {
    const getter = vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('Storage access blocked')
    })
    vi.resetModules()
    const backendModule = await import('./storageBackend')
    const storageModule = await import('./storage')

    expect(getter).not.toHaveBeenCalled()
    expect(() => backendModule.default.getItem('mt-nickname')).toThrow('Storage access blocked')
    expect(storageModule.storage.getNickname()).toBe('')
  })

  it.each(['mt-nickname', 'mt-userId', 'mt-auth-cookies', 'mt-rejoin-token', 'legacy-key'])(
    'passes the existing key through unchanged: %s',
    (key) => {
      expect(storageBackend.getItem(key)).toBeNull()
      localStorage.setItem(key, 'existing-fixture')
      expect(storageBackend.getItem(key)).toBe('existing-fixture')
      storageBackend.setItem(key, 'updated-fixture')
      expect(localStorage.getItem(key)).toBe('updated-fixture')
      storageBackend.removeItem(key)
      expect(localStorage.getItem(key)).toBeNull()
    },
  )

  it('uses the current global storage on each call, not one captured at import', () => {
    const replacement = {
      getItem: vi.fn(() => 'replacement-fixture'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage
    vi.spyOn(globalThis, 'localStorage', 'get').mockReturnValue(replacement)

    expect(storageBackend.getItem('mt-nickname')).toBe('replacement-fixture')
    storageBackend.setItem('mt-nickname', 'fixture')
    storageBackend.removeItem('mt-nickname')
    expect(replacement.getItem).toHaveBeenCalledWith('mt-nickname')
    expect(replacement.setItem).toHaveBeenCalledWith('mt-nickname', 'fixture')
    expect(replacement.removeItem).toHaveBeenCalledWith('mt-nickname')
  })

  it('retains browser values across module reloads', async () => {
    storageBackend.setItem('mt-nickname', 'persisted-fixture')
    vi.resetModules()
    const reloaded = await import('./storageBackend')
    expect(reloaded.default.getItem('mt-nickname')).toBe('persisted-fixture')
  })

  it('keeps the public prefix and string serialization unchanged', () => {
    localStorage.setItem('mt-nickname', 'existing-nickname')
    localStorage.setItem('mt-volume', '0.25')
    expect(storage.getNickname()).toBe('existing-nickname')
    expect(storage.getVolume()).toBe(0.25)

    storage.setNickname('updated-nickname')
    storage.setUserId('canonical-fixture')
    storage.setVolume(0.5)
    storage.setLyricEnableBlur(true)
    expect(localStorage.getItem('mt-nickname')).toBe('updated-nickname')
    expect(localStorage.getItem('mt-userId')).toBe('canonical-fixture')
    expect(localStorage.getItem('mt-volume')).toBe('0.5')
    expect(localStorage.getItem('mt-lyricEnableBlur')).toBe('true')
    expect(localStorage.getItem('mt-mt-nickname')).toBeNull()
    storage.clearUserId()
    expect(localStorage.getItem('mt-userId')).toBeNull()
  })

  it('preserves Web auth and rejoin JSON persistence with fake fixtures', () => {
    storage.setAuthCookies([{ platform: 'netease', cookie: 'cookie-fixture' }])
    storage.setRejoinToken('room-fixture', 'token-fixture', Date.now() + 60_000)
    expect(storage.getAuthCookies()).toEqual([{ platform: 'netease', cookie: 'cookie-fixture' }])
    expect(storage.getRejoinToken('room-fixture')).toBe('token-fixture')
    expect(localStorage.getItem('mt-auth-cookies')).not.toBeNull()
    expect(localStorage.getItem('mt-rejoin-token')).not.toBeNull()
    storage.clearRejoinToken('room-fixture')
    expect(localStorage.getItem('mt-rejoin-token')).toBeNull()
  })

  it('retains safeGet, safeSet and safeRemove fallbacks when the storage getter is blocked', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('Storage access blocked')
    })

    expect(storage.getNickname()).toBe('')
    expect(storage.getUserId()).toBe('')
    expect(storage.getVolume()).toBe(0.8)
    expect(storage.getBgRenderer()).toBe(SETTING_DEFAULTS.bgRenderer)
    expect(storage.getAuthCookies()).toEqual([])
    expect(storage.getRejoinToken('room-fixture')).toBeNull()
    expect(() => storage.setNickname('nickname-fixture')).not.toThrow()
    expect(() => storage.setAuthCookies([])).not.toThrow()
    expect(() => storage.clearUserId()).not.toThrow()
  })

  it('lets backend method errors reach the existing public safety wrappers', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Read blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Remove blocked')
    })

    expect(() => storageBackend.getItem('mt-nickname')).toThrow('Read blocked')
    expect(() => storageBackend.setItem('mt-nickname', 'fixture')).toThrow('Quota exceeded')
    expect(() => storageBackend.removeItem('mt-userId')).toThrow('Remove blocked')
    expect(storage.getNickname()).toBe('')
    expect(() => storage.setNickname('fixture')).not.toThrow()
    expect(() => storage.clearUserId()).not.toThrow()
  })
})
