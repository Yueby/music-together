import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import type { MiniAppManifest } from '@discourse-mini-app/sdk/pack'
import { packageClientApp, resolveClientManifest } from './clientPackage.ts'
import { MAPP_CLIENT_HTML } from './clientConfig.ts'

const appId = '019a2a58-1111-7000-8111-000000000001'
const roomUrl = 'wss://rooms.example.com/socket.io/?EIO=4&transport=websocket'
const clientCss = '.flex{display:flex}.grid{display:grid}.items-center{align-items:center}.inline-flex{display:inline-flex}.px-4{padding-inline:1rem}.text-sm{font-size:.875rem}'
const template: MiniAppManifest = {
  format: 1,
  id: '00000000-0000-7000-8000-000000000000',
  version: '0.2.0',
  entry: 'index.html',
  script: 'app.js',
  style: 'app.css',
  permissions: [],
}
const permissions = ['user.read', 'audio.webAudio', 'network.websocket', 'network.request', 'storage.read', 'storage.write']
const endpoints = {
  roomAudio: {
    url: 'https://rooms.example.com/api/mapp/audio',
    method: 'GET', query: ['roomId', 'trackId'], auth: 'platform',
  },
  musicSearch: {
    url: 'https://rooms.example.com/api/music/search',
    method: 'GET', query: ['source', 'keyword', 'limit', 'page', 'type'], auth: 'platform',
  },
  musicLyric: {
    url: 'https://rooms.example.com/api/music/lyric',
    method: 'GET', query: ['source', 'lyricId'], auth: 'platform',
  },
  musicTtml: {
    url: 'https://rooms.example.com/api/music/ttml',
    method: 'GET', query: ['source', 'id'], auth: 'platform',
  },
  musicCover: {
    url: 'https://rooms.example.com/api/music/cover-proxy',
    method: 'GET', query: ['url'], auth: 'platform',
  },
  musicArtist: {
    url: 'https://rooms.example.com/api/music/artist',
    method: 'GET', query: ['source', 'id'], auth: 'platform',
  },
  musicArtistSongs: {
    url: 'https://rooms.example.com/api/music/artist/songs',
    method: 'GET', query: ['source', 'id', 'offset', 'limit'], auth: 'platform',
  },
  musicArtistAlbums: {
    url: 'https://rooms.example.com/api/music/artist/albums',
    method: 'GET', query: ['source', 'id', 'offset', 'limit'], auth: 'platform',
  },
  musicPlaylist: {
    url: 'https://rooms.example.com/api/music/playlist',
    method: 'GET', query: ['source', 'id', 'type', 'limit', 'offset', 'total'], auth: 'platform',
  },
  musicMyPlaylist: {
    url: 'https://rooms.example.com/api/music/playlist/mine',
    method: 'GET', query: ['source', 'id', 'type', 'limit', 'offset', 'total', 'roomId'], auth: 'platform',
  },
}
const websockets = { roomSocket: { url: roomUrl, auth: 'platform' } }

function zipEntries(zip: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>()
  let offset = 0
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = zip.readUInt32LE(offset + 18)
    const nameSize = zip.readUInt16LE(offset + 26)
    const extraSize = zip.readUInt16LE(offset + 28)
    const name = zip.subarray(offset + 30, offset + 30 + nameSize).toString('utf8')
    const start = offset + 30 + nameSize + extraSize
    entries.set(name, inflateRawSync(zip.subarray(start, start + compressedSize)))
    offset = start + compressedSize
  }
  return entries
}

async function withFixture(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'music-together-client-package-'))
  try {
    await mkdir(join(directory, 'dist/client-web'), { recursive: true })
    await Promise.all([
      writeFile(join(directory, 'manifest.json'), JSON.stringify(template)),
      writeFile(join(directory, 'dist/client-web/app.js'), '(()=>{globalThis.fixtureReady=true})()'),
      writeFile(join(directory, 'dist/client-web/app.css'), clientCss),
    ])
    await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe('client package manifest contract', () => {
  it('declares exactly the reviewed capabilities and targets with template version as default', () => {
    expect(resolveClientManifest(template, { appId, roomUrl })).toEqual({
      format: 1, id: appId, version: '0.2.0',
      entry: 'index.html', script: 'app.js', style: 'app.css',
      permissions, endpoints, websockets,
    })
    expect(template.id).toBe('00000000-0000-7000-8000-000000000000')
    expect(template.permissions).toEqual([])
  })

  it('copies only identity and optional name, never extra permissions, assets, or targets from the template', () => {
    const extended: MiniAppManifest = {
      ...template,
      name: 'Fixture Music Together',
      permissions: ['assets.remote', 'theme.read', 'code.eval', 'code.modules', 'cookies.read',
        'storage.read', 'clipboard.read', 'links.open'],
      assets: ['audio/probe.wav'],
      remote_assets: {
        'audio/fixture.mp3': {
          url: 'https://assets.example.com/fixture.mp3', sha256: 'a'.repeat(64), size: 42, mime: 'audio/mpeg',
        },
      },
      endpoints: { probe: { url: 'https://probe.example.com/audio', method: 'GET', auth: 'none' } },
      websockets: { sync: { url: 'wss://probe.example.com/mapp-sync', auth: 'platform' } },
      links: ['https://probe.example.com/'],
      code: { modules: ['fixture.js'] },
    }
    const before = structuredClone(extended)
    expect(resolveClientManifest(extended, { appId, version: '1.2.3', roomUrl })).toEqual({
      format: 1, id: appId, version: '1.2.3', name: 'Fixture Music Together',
      entry: 'index.html', script: 'app.js', style: 'app.css',
      permissions, endpoints, websockets,
    })
    expect(extended).toEqual(before)
  })

  it.each(['', template.id, 'invalid-id', '019a2a58-1111-4000-8111-000000000001', `${appId}\n`])(
    'rejects invalid platform identity %#', (id) => {
      expect(() => resolveClientManifest(template, { appId: id, roomUrl })).toThrow()
    },
  )

  it.each(['', '1.0', '01.0.0', '1.0.0-debug', '1.0.0+meta', ' 1.0.0', '1.0.0\n', `${'1'.repeat(65)}.0.0`])(
    'rejects invalid versions %#', (version) => {
      expect(() => resolveClientManifest(template, { appId, version, roomUrl })).toThrow()
    },
  )

  it('rejects signed queries and client session credentials instead of passing them through', () => {
    for (const suffix of ['&token=fixture-jwt', '&sid=fixture-session', '&signature=fixture-signature']) {
      expect(() => resolveClientManifest(template, { appId, roomUrl: roomUrl + suffix }))
        .toThrow('MAPP_CLIENT_TARGET_REJECTED')
    }
  })
})

describe('offline client SDK packaging', () => {
  it('packs only the built client plus manifest and ignores unrelated build output', async () => {
    await withFixture(async (directory) => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.fixture-signature'
      await Promise.all([
        writeFile(join(directory, 'dist/client-web/app.js.map'), JSON.stringify({ businessJWT: jwt })),
        writeFile(join(directory, 'dist/client-web/config.json'), JSON.stringify({ token: jwt })),
        writeFile(join(directory, 'dist/client-web/index.html'), '<iframe src="https://fixture.invalid"></iframe>'),
        writeFile(join(directory, 'dist/client-web/strings.json'), JSON.stringify({ token: jwt })),
        writeFile(join(directory, 'dist/client-web/unknown.js'), `const token=${JSON.stringify(jwt)}`),
      ])
      const result = await packageClientApp({ directory, appId, roomUrl })
      expect(result.file).toBe(join(directory, 'dist/client-package/app.zip'))
      expect(result.size).toBeGreaterThan(0)
      expect(result.zipSha256).toMatch(/^[a-f0-9]{64}$/)
      const zip = await readFile(result.file)
      expect(result.size).toBe(zip.byteLength)
      const entries = zipEntries(zip)
      expect([...entries.keys()].sort()).toEqual(['app.css', 'app.js', 'index.html', 'manifest.json', 'strings.json'])
      expect(entries.get('index.html')!.toString()).toBe(MAPP_CLIENT_HTML)
      expect(entries.get('strings.json')!.toString()).toBe('{}')
      expect(entries.get('app.js')).toEqual(await readFile(join(directory, 'dist/client-web/app.js')))
      expect(entries.get('app.css')).toEqual(await readFile(join(directory, 'dist/client-web/app.css')))
      expect(JSON.parse(entries.get('manifest.json')!.toString())).toEqual({
        format: 1, id: appId, version: '0.2.0',
        entry: 'index.html', script: 'app.js', style: 'app.css',
        permissions, endpoints, websockets,
      })
      for (const content of entries.values()) {
        expect(content.toString()).not.toContain(jwt)
        expect(content.toString()).not.toContain('remote_assets')
        expect(content.toString()).not.toContain('audio/probe.wav')
      }
    })
  })

  it('refuses a base-only stylesheet before creating a client ZIP', async () => {
    await withFixture(async (directory) => {
      await writeFile(join(directory, 'dist/client-web/app.css'), '*,body{box-sizing:border-box}')
      await expect(packageClientApp({ directory, appId, roomUrl })).rejects.toThrow('CLIENT_STYLES_INCOMPLETE')
      await expect(readFile(join(directory, 'dist/client-package/app.zip'))).rejects.toThrow()
    })
  })

  it.each(['app.js', 'app.css'])('fails when the client build is missing %s', async (file) => {
    await withFixture(async (directory) => {
      await rm(join(directory, 'dist/client-web', file))
      await expect(packageClientApp({ directory, appId, roomUrl })).rejects.toThrow()
      await expect(readFile(join(directory, 'dist/client-package/app.zip'))).rejects.toThrow()
    })
  })

  it.each([
    { appId: 'invalid-id', version: '1.0.0' },
    { appId, version: '1.0.0-debug' },
  ])('rejects invalid release identity before writing output %#', async (identity) => {
    await withFixture(async (directory) => {
      await expect(packageClientApp({ directory, roomUrl, ...identity })).rejects.toThrow()
      await expect(readFile(join(directory, 'dist/client-package/app.zip'))).rejects.toThrow()
    })
  })

  it.each([
    ['app.js', 'const unsafe="</script>"'],
    ['app.css', clientCss + '/* </style> */'],
  ])('keeps the real SDK closing-tag guard for %s', async (file, source) => {
    await withFixture(async (directory) => {
      await writeFile(join(directory, 'dist/client-web', file), source)
      await expect(packageClientApp({ directory, appId, roomUrl })).rejects.toThrow('Unsupported closing tag in bundle')
      await expect(readFile(join(directory, 'dist/client-package/app.zip'))).rejects.toThrow()
    })
  })
})
