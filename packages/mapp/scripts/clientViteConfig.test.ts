import { afterEach, describe, expect, it, vi } from 'vitest'
import configExport from '../vite.config.ts'
import { createMappClientConfig } from '../../client/mapp.vite.ts'

const roomUrl = 'wss://music.example.test/socket.io/?EIO=4&transport=websocket'
afterEach(() => vi.unstubAllEnvs())

describe('explicit client build configuration', () => {
  it('keeps all host seams ahead of the generic client source alias and selects one IIFE/CSS output', () => {
    const config = createMappClientConfig(roomUrl, '0.4.0')
    const aliases = config.resolve?.alias
    expect(Array.isArray(aliases)).toBe(true)
    if (!Array.isArray(aliases)) throw new Error('ALIAS_FIXTURE_FAILED')
    expect(aliases.map((alias) => alias.find)).toEqual([
      '@/lib/playbackSoundFactory',
      '@/lib/metadataFetch',
      '@/lib/RoomCommands',
      '@/lib/roomCheck',
      '@/lib/audioUnlock',
      '@/lib/hostRuntime',
      '@/lib/storageBackend',
      '@',
    ])
    expect(config.define).toMatchObject({
      __MAPP_ROOM_ENDPOINT__: '"roomSocket"',
      __MAPP_ROOM_URL__: JSON.stringify(roomUrl),
      __APP_VERSION__: '"0.4.0"',
      'process.env.NODE_ENV': '"production"',
      'import.meta.env.VITE_SERVER_URL': '"https://music.example.test"',
    })
    expect(config.build).toMatchObject({
      outDir: 'dist/client-web',
      cssCodeSplit: false,
      sourcemap: false,
      lib: { name: 'MusicTogetherClient', formats: ['iife'], cssFileName: 'app' },
      rolldownOptions: { output: { codeSplitting: false } },
    })
    expect(config.build?.lib && config.build.lib.entry).toMatch(/clientMain\.ts$/)
  })

  it('builds the client by default, taking the version from the manifest unless overridden', async () => {
    if (typeof configExport !== 'function') throw new Error('CONFIG_FIXTURE_FAILED')
    vi.stubEnv('MAPP_ROOM_URL', roomUrl)
    vi.stubEnv('MINI_APP_VERSION', '')
    const fallback = await configExport({ command: 'build', mode: 'production' })
    expect(fallback.build).toMatchObject({ outDir: 'dist/client-web', lib: { name: 'MusicTogetherClient' } })
    expect(fallback.define).toMatchObject({ __APP_VERSION__: '"0.2.0"' })
    vi.stubEnv('MINI_APP_VERSION', '0.4.0')
    const overridden = await configExport({ command: 'build', mode: 'production' })
    expect(overridden.define).toMatchObject({ __APP_VERSION__: '"0.4.0"' })
  })

  it('requires a reviewed WSS room URL to build, but loads an empty config for other commands', () => {
    if (typeof configExport !== 'function') throw new Error('CONFIG_FIXTURE_FAILED')
    vi.stubEnv('MAPP_ROOM_URL', '')
    expect(() => configExport({ command: 'build', mode: 'production' })).toThrow('MAPP_CLIENT_TARGET_REJECTED')
    expect(configExport({ command: 'serve', mode: 'test' })).toEqual({})
  })
})
