// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { storage } from './storage'
import { clearMemoryStorage } from '../../../mapp/src/compat/storageBackend'

vi.mock('@/lib/storageBackend', async () => await import('../../../mapp/src/compat/storageBackend'))

beforeEach(() => {
  clearMemoryStorage()
  vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('NATIVE_STORAGE_TRIPWIRE')
  })
  vi.spyOn(globalThis, 'sessionStorage', 'get').mockImplementation(() => {
    throw new Error('NATIVE_SESSION_TRIPWIRE')
  })
})
afterEach(() => {
  clearMemoryStorage()
  vi.restoreAllMocks()
})

describe('shared settings facade with the micro-app memory backend', () => {
  it('keeps existing setting and identity APIs usable without native storage access', () => {
    expect(storage.getVolume()).toBe(0.8)
    storage.setVolume(0.4)
    storage.setNickname('Fixture listener')
    storage.setUserId('server-confirmed-fixture')
    expect(storage.getVolume()).toBe(0.4)
    expect(storage.getNickname()).toBe('Fixture listener')
    expect(storage.getUserId()).toBe('server-confirmed-fixture')
    storage.clearUserId()
    expect(storage.getUserId()).toBe('')
  })

  it('never stores platform credentials or duplicates the session rejoin ticket', () => {
    storage.setAuthCookies([{ platform: 'netease', cookie: 'fixture-only-credential' }])
    storage.upsertAuthCookie('tencent', 'another-fixture')
    storage.setRejoinToken('ABC123', 'fixture-only-ticket', Date.now() + 60_000)
    expect(storage.getAuthCookies()).toEqual([])
    expect(storage.hasAuthCookie('netease')).toBe(false)
    expect(storage.getRejoinToken('ABC123')).toBeNull()
  })

  it('clears app-memory settings at the explicit lifetime boundary', () => {
    storage.setNickname('Fixture listener')
    storage.setUserId('server-confirmed-fixture')
    clearMemoryStorage()
    expect(storage.getNickname()).toBe('')
    expect(storage.getUserId()).toBe('')
    expect(storage.getVolume()).toBe(0.8)
  })
})
