import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'
import type { MappHost } from './MappHost.ts'
import { getMappHost, installMappHost } from './hostBinding.ts'
import { playbackSoundFactory } from './hostModules/playbackSoundFactory.ts'
import { metadataFetch } from './hostModules/metadataFetch.ts'
import { roomCommands } from './hostModules/RoomCommands.ts'
import { roomCheck } from './hostModules/roomCheck.ts'
import { isAudioUnlocked, unlockAudio } from './hostModules/audioUnlock.ts'
import { hostRuntime } from './hostModules/hostRuntime.ts'

let remove: (() => void) | undefined
afterEach(() => {
  remove?.()
  remove = undefined
  vi.unstubAllGlobals()
})
function fixture() {
  const response = { ok: true, status: 200, json: async () => ({}), text: async () => '{}' }
  const sound = { fixture: 'sound' }
  const socket = { fixture: 'socket' }
  const host = {
    session: { socket },
    playbackSoundFactory: { create: vi.fn(() => sound), preload: vi.fn() },
    metadataFetch: vi.fn(async () => response),
    roomCommands: { create: vi.fn(() => true), join: vi.fn(() => true), leave: vi.fn() },
    roomCheck: vi.fn(async () => ({ name: 'Fixture', hasPassword: true, userCount: 0 })),
    isAudioUnlocked: vi.fn(() => true),
    unlockAudio: vi.fn(async () => {}),
    connect: vi.fn(),
    dispose: vi.fn(async () => {}),
  }
  return { host, bound: host as unknown as MappHost, socket, sound, response }
}

describe('selected micro-app host modules', () => {
  it('fails closed before binding without creating a native fallback or another owner', async () => {
    const native = vi.fn(() => {
      throw new Error('NATIVE_TRIPWIRE')
    })
    for (const key of ['fetch', 'WebSocket', 'AudioContext', 'localStorage']) vi.stubGlobal(key, native)
    const f = fixture()
    expect(() => getMappHost()).toThrow('MAPP_BINDINGS_REQUIRED')
    expect(() => isAudioUnlocked()).toThrow('MAPP_BINDINGS_REQUIRED')
    expect(() => roomCommands.leave(f.bound.session.socket)).toThrow('MAPP_BINDINGS_REQUIRED')
    // Reported through the promise, so callers' `.then(ok, fail)` / try-catch see it instead of a synchronous throw.
    const pending = metadataFetch('/api/music/search')
    expect(pending).toBeInstanceOf(Promise)
    await expect(pending).rejects.toThrow('MAPP_BINDINGS_REQUIRED')
    expect(native).not.toHaveBeenCalled()
    expect(f.host.connect).not.toHaveBeenCalled()
    expect(f.host.dispose).not.toHaveBeenCalled()
  })

  it('delegates every selected seam to the same host and preserves inputs', async () => {
    const f = fixture()
    remove = installMappHost(f.bound)
    expect(getMappHost()).toBe(f.bound)
    expect(hostRuntime.kind).toBe('mapp')
    const track = { id: 'fixture' } as Track
    const options = { src: ['https://unused.example.test/fixture'] }
    expect(playbackSoundFactory.create(track, options)).toBe(f.sound)
    expect(f.host.playbackSoundFactory.create).toHaveBeenCalledExactlyOnceWith(track, options)
    expect(playbackSoundFactory.allowLoadRetry).toBe(false)
    expect(playbackSoundFactory.supportsHtml5Analysis).toBe(false)
    // The announced next track must reach the host too, or the shared hook's preload silently does nothing.
    playbackSoundFactory.preload!(track)
    expect(f.host.playbackSoundFactory.preload).toHaveBeenCalledExactlyOnceWith(track)
    const init = { signal: new AbortController().signal, credentials: 'include' as const }
    expect(await metadataFetch('/api/music/search', init)).toBe(f.response)
    expect(f.host.metadataFetch).toHaveBeenCalledExactlyOnceWith('/api/music/search', init)
    const socket = f.bound.session.socket
    const create = { nickname: 'Fixture' }
    const join = { roomId: 'ABC123', nickname: 'Fixture' }
    expect(roomCommands.create(socket, create)).toBe(true)
    expect(roomCommands.join(socket, join, { automatic: true })).toBe(true)
    roomCommands.leave(socket)
    expect(f.host.roomCommands.create).toHaveBeenCalledExactlyOnceWith(socket, create)
    expect(f.host.roomCommands.join).toHaveBeenCalledExactlyOnceWith(socket, join, { automatic: true })
    expect(f.host.roomCommands.leave).toHaveBeenCalledExactlyOnceWith(socket)
    await roomCheck(socket, 'ABC123', init)
    expect(f.host.roomCheck).toHaveBeenCalledExactlyOnceWith(socket, 'ABC123', init)
    expect(isAudioUnlocked()).toBe(true)
    await unlockAudio()
    expect(f.host.unlockAudio).toHaveBeenCalledOnce()
    expect(f.host.connect).not.toHaveBeenCalled()
    expect(f.host.dispose).not.toHaveBeenCalled()
  })

  it('keeps binding ownership explicit and makes an old cleanup harmless after replacement', () => {
    const first = fixture(),
      second = fixture()
    const releaseFirst = installMappHost(first.bound)
    remove = releaseFirst
    expect(() => installMappHost(first.bound)).toThrow('MAPP_HOST_ALREADY_BOUND')
    expect(() => installMappHost(second.bound)).toThrow('MAPP_HOST_ALREADY_BOUND')
    releaseFirst()
    releaseFirst()
    remove = installMappHost(second.bound)
    releaseFirst()
    expect(getMappHost()).toBe(second.bound)
    remove()
    expect(() => getMappHost()).toThrow('MAPP_BINDINGS_REQUIRED')
    expect(first.host.dispose).not.toHaveBeenCalled()
    expect(second.host.dispose).not.toHaveBeenCalled()
  })
})
