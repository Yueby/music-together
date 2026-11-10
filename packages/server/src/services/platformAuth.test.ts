import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPlatformResolvers,
  mapPlatformUserId,
  PlatformAuth,
  readPlatformConfig,
  type PlatformConfig,
} from './platformAuth.js'

const config: PlatformConfig = {
  issuer: 'https://linux.do/forum',
  audience: 'https://music.example.com',
  appId: '01900000-0000-7000-8000-000000000001',
}
const ORIGIN = 'https://linux.do'
const REJECTED = 'Platform authentication rejected'
const epoch = 1_700_000_000_000
const seconds = epoch / 1000

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

function fixture() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const kid = createHash('sha256')
    .update(publicKey.export({ type: 'spki', format: 'der' }))
    .digest('hex')
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig' }
  const token = (claims: Record<string, unknown>, header: Record<string, unknown> = {}) => {
    const input = [
      { alg: 'ES256', typ: 'mini-app-access+jwt', kid, ...header },
      {
        iss: config.issuer,
        aud: config.audience,
        app_id: config.appId,
        sub: '123',
        version: '0.2.0',
        iat: seconds,
        nbf: seconds,
        exp: seconds + 300,
        jti: 'a'.repeat(16),
        htm: 'GET',
        ...claims,
      },
    ]
      .map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'))
      .join('.')
    const signature = sign('sha256', Buffer.from(input), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    return input + '.' + signature.toString('base64url')
  }
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ keys: [jwk] })))
  const auth = (now = () => epoch) => new PlatformAuth(config, fetcher, now)
  return { token, fetcher, jwk, auth }
}

// Claims and request targets for each endpoint the service verifies.
const roomSocket = {
  channel: 'production',
  scopes: ['network.websocket'],
  htu: config.audience + '/socket.io/?EIO=4&transport=websocket',
  query_keys: [],
}
const roomSocketUrl = (token: string) => '/socket.io/?EIO=4&transport=websocket&mini_app_token=' + token
const media = {
  channel: 'production',
  scopes: ['network.request'],
  htu: config.audience + '/api/mapp/audio',
  query_keys: ['roomId', 'trackId'],
}
const mediaUrl = '/api/mapp/audio?roomId=ABC_-1&trackId=track'
const search = {
  channel: 'production',
  scopes: ['network.request'],
  htu: config.audience + '/api/music/search',
  query_keys: ['source', 'keyword', 'limit', 'page', 'type'],
}
const searchUrl = '/api/music/search?source=netease&keyword=fixture'

describe('readPlatformConfig', () => {
  const env = { MAPP_ISSUER: config.issuer, MAPP_AUDIENCE: config.audience, MAPP_APP_ID: config.appId }

  it('stays disabled when nothing is configured, including blank values', () => {
    expect(readPlatformConfig({})).toBeUndefined()
    expect(
      readPlatformConfig({ MAPP_ISSUER: '', MAPP_AUDIENCE: ' ', MAPP_APP_ID: '', MAPP_JWKS_FILE: '' }),
    ).toBeUndefined()
  })

  it('enables on a complete configuration and normalizes it', () => {
    expect(readPlatformConfig(env)).toEqual(config)
    expect(readPlatformConfig({ ...env, MAPP_AUDIENCE: config.audience + ':443' })).toEqual(config)
    expect(readPlatformConfig({ ...env, MAPP_ISSUER: 'https://linux.do/forum/' })?.issuer).toBe(
      'https://linux.do/forum',
    )
    expect(readPlatformConfig({ ...env, MAPP_JWKS_FILE: join(tmpdir(), 'jwks.json') })?.jwksFile).toBeTruthy()
  })

  it.each([
    [{ MAPP_ISSUER: undefined }, 'MAPP_ISSUER'],
    [{ MAPP_AUDIENCE: undefined }, 'MAPP_AUDIENCE'],
    [{ MAPP_APP_ID: undefined }, 'MAPP_APP_ID'],
  ])('refuses a partial configuration %#', (changes, name) => {
    expect(() => readPlatformConfig({ ...env, ...changes })).toThrow(name)
  })

  it('refuses a key file without the rest of the configuration', () => {
    expect(() => readPlatformConfig({ MAPP_JWKS_FILE: join(tmpdir(), 'jwks.json') })).toThrow('MAPP_ISSUER')
  })

  it('keeps sandbox tokens off unless MAPP_ALLOW_SANDBOX is explicitly true', () => {
    expect(readPlatformConfig(env)?.allowSandbox).toBeUndefined()
    expect(readPlatformConfig({ ...env, MAPP_ALLOW_SANDBOX: 'false' })?.allowSandbox).toBeUndefined()
    expect(readPlatformConfig({ ...env, MAPP_ALLOW_SANDBOX: 'true' })?.allowSandbox).toBe(true)
    expect(() => readPlatformConfig({ ...env, MAPP_ALLOW_SANDBOX: 'yes' })).toThrow('MAPP_ALLOW_SANDBOX')
    expect(() => readPlatformConfig({ MAPP_ALLOW_SANDBOX: 'true' })).toThrow('MAPP_ISSUER')
  })

  it.each([
    [{ MAPP_ISSUER: 'not a url' }, 'MAPP_ISSUER'],
    [{ MAPP_ISSUER: 'http://linux.do' }, 'MAPP_ISSUER'],
    [{ MAPP_ISSUER: 'https://linux.do?x=1' }, 'MAPP_ISSUER'],
    [{ MAPP_ISSUER: 'https://user:pass@linux.do' }, 'MAPP_ISSUER'],
    [{ MAPP_AUDIENCE: 'http://music.example.com' }, 'MAPP_AUDIENCE'],
    [{ MAPP_AUDIENCE: config.audience + ':444' }, 'MAPP_AUDIENCE'],
    [{ MAPP_AUDIENCE: config.audience + '/path' }, 'MAPP_AUDIENCE'],
    [{ MAPP_AUDIENCE: 'https://linux.do' }, 'MAPP_AUDIENCE'],
    [{ MAPP_APP_ID: 'not-a-uuid' }, 'MAPP_APP_ID'],
    [{ MAPP_APP_ID: '01900000-0000-4000-8000-000000000001' }, 'MAPP_APP_ID'],
    [{ MAPP_JWKS_FILE: './relative.json' }, 'MAPP_JWKS_FILE'],
  ])('rejects invalid configuration %#, naming the variable but not its value', (changes, name) => {
    let message = ''
    try {
      readPlatformConfig({ ...env, ...changes })
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain(name)
    for (const value of Object.values(changes)) expect(message).not.toContain(value)
  })
})

describe('sandbox channel (explicit opt-in)', () => {
  const sandbox = (claims: object) => ({ ...claims, channel: 'sandbox' })
  const allowing = (f: ReturnType<typeof fixture>) =>
    new PlatformAuth({ ...config, allowSandbox: true }, f.fetcher, () => epoch)

  it('rejects sandbox tokens by default', async () => {
    const f = fixture()
    await expect(f.auth().verifyRoomSocket(roomSocketUrl(f.token(sandbox(roomSocket))), ORIGIN)).rejects.toThrow(
      REJECTED,
    )
  })

  it('accepts sandbox and production tokens once allowed, for the socket and HTTP endpoints', async () => {
    const f = fixture()
    const auth = allowing(f)
    await expect(auth.verifyRoomSocket(roomSocketUrl(f.token(sandbox(roomSocket))), ORIGIN)).resolves.toMatchObject({
      channel: 'sandbox',
    })
    await expect(auth.verifyRoomSocket(roomSocketUrl(f.token(roomSocket)), ORIGIN)).resolves.toMatchObject({
      channel: 'production',
    })
    await expect(
      auth.verifyRoomMedia(mediaUrl, ORIGIN, 'Bearer ' + f.token(sandbox(media)), 'GET'),
    ).resolves.toMatchObject({ channel: 'sandbox' })
    await expect(
      auth.verifyMusicMetadata(searchUrl, ORIGIN, 'Bearer ' + f.token(sandbox(search)), 'GET'),
    ).resolves.toMatchObject({ channel: 'sandbox' })
  })

  it('still enforces every other check on sandbox tokens', async () => {
    const f = fixture()
    const auth = allowing(f)
    for (const claims of [
      { htu: config.audience + '/other' },
      { scopes: ['network.request'] },
      { aud: 'https://evil.example' },
      { app_id: '01900000-0000-7000-8000-000000000002' },
      { channel: 'staging' },
    ]) {
      await expect(
        auth.verifyRoomSocket(roomSocketUrl(f.token({ ...sandbox(roomSocket), ...claims })), ORIGIN),
      ).rejects.toThrow(REJECTED)
    }
    await expect(
      auth.verifyRoomSocket(roomSocketUrl(f.token(sandbox(roomSocket))), 'https://evil.example'),
    ).rejects.toThrow(REJECTED)
  })
})

describe('verifyRoomSocket (production Socket.IO handshake)', () => {
  it('accepts a production token and caches keys', async () => {
    const f = fixture()
    const auth = f.auth()
    await expect(auth.verifyRoomSocket(roomSocketUrl(f.token(roomSocket)), ORIGIN)).resolves.toMatchObject({
      sub: '123',
      channel: 'production',
    })
    await expect(auth.verifyRoomSocket(roomSocketUrl(f.token(roomSocket)), ORIGIN)).resolves.toBeTruthy()
    expect(f.fetcher).toHaveBeenCalledTimes(1)
    expect(f.fetcher.mock.calls[0][0]).toBe(config.issuer + '/mini-app-api/jwks')
    expect(f.fetcher).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ redirect: 'error' }))
  })

  it.each([
    ['sandbox channel', { channel: 'sandbox' }],
    ['wrong scope', { scopes: ['network.request'] }],
    ['issuer', { iss: 'https://evil.example' }],
    ['audience', { aud: 'https://evil.example' }],
    ['app', { app_id: 'wrong' }],
    ['expired', { exp: seconds }],
    ['transport', { htu: config.audience + '/socket.io/?EIO=4&transport=polling' }],
    ['broader query', { htu: config.audience + '/socket.io/', query_keys: ['EIO', 'transport'] }],
    ['undeclared query', { query_keys: ['extra'] }],
  ])('rejects claims with wrong %s', async (_name, claims) => {
    const f = fixture()
    await expect(
      f.auth().verifyRoomSocket(roomSocketUrl(f.token({ ...roomSocket, ...claims })), ORIGIN),
    ).rejects.toThrow(REJECTED)
  })

  it.each([
    (raw: string) => raw.replace('/socket.io/', '/other/'),
    (raw: string) => raw.replace('EIO=4', 'EIO=3'),
    (raw: string) => raw + '&extra=1',
    (raw: string) => raw + '&mini_app_token=x',
    (raw: string) => raw.replace('mini_app_token=', '%6dini_app_token='),
    (raw: string) => raw + '#fragment',
    (raw: string) => config.audience + raw,
    (raw: string) => '//evil.example' + raw,
  ])('rejects a changed raw handshake %# before loading keys', async (alter) => {
    const f = fixture()
    await expect(f.auth().verifyRoomSocket(alter(roomSocketUrl(f.token(roomSocket))), ORIGIN)).rejects.toThrow(REJECTED)
    expect(f.fetcher).not.toHaveBeenCalled()
  })

  it.each([undefined, '', 'null', 'https://evil.example', config.issuer])(
    'rejects Origin %# before loading keys',
    async (origin) => {
      const f = fixture()
      await expect(f.auth().verifyRoomSocket(roomSocketUrl(f.token(roomSocket)), origin)).rejects.toThrow(REJECTED)
      expect(f.fetcher).not.toHaveBeenCalled()
    },
  )
})

describe('verifyRoomMedia (production roomAudio)', () => {
  const ok = (f: ReturnType<typeof fixture>, claims = {}, url = mediaUrl, method = 'GET') =>
    f.auth().verifyRoomMedia(url, ORIGIN, 'Bearer ' + f.token({ ...media, ...claims }), method)

  it('accepts exactly the declared roomId/trackId target', async () => {
    const f = fixture()
    await expect(ok(f)).resolves.toMatchObject({ sub: '123', scopes: ['network.request'] })
  })
  it.each([
    { channel: 'sandbox' },
    { scopes: ['network.websocket'] },
    { htu: config.audience + '/api/music/url' },
    { query_keys: ['roomId'] },
    { query_keys: ['roomId', 'trackId', 'url'] },
    { query_keys: ['trackId', 'trackId'] },
  ])('rejects invalid claims %#', async (claims) => {
    await expect(ok(fixture(), claims)).rejects.toThrow(REJECTED)
  })
  it.each([
    mediaUrl + '&roomId=ABC_-1',
    mediaUrl + '&url=https://evil.test',
    mediaUrl + '#fragment',
    mediaUrl.replace('ABC_-1', 'abcdef'),
    mediaUrl.replace('trackId=track', 'trackId='),
    mediaUrl.replace('/audio?', '/audio/?'),
    config.audience + mediaUrl,
  ])('rejects a changed target %# before loading keys', async (raw) => {
    const f = fixture()
    await expect(ok(f, {}, raw)).rejects.toThrow(REJECTED)
    expect(f.fetcher).not.toHaveBeenCalled()
  })
  it.each(['HEAD', 'POST'])('requires GET, not %s', async (method) => {
    const f = fixture()
    await expect(ok(f, {}, mediaUrl, method)).rejects.toThrow(REJECTED)
    expect(f.fetcher).not.toHaveBeenCalled()
  })
  it.each([undefined, '', 'Basic fixture', 'Bearer'])('requires a header Bearer %#', async (authorization) => {
    const f = fixture()
    await expect(f.auth().verifyRoomMedia(mediaUrl, ORIGIN, authorization, 'GET')).rejects.toThrow(REJECTED)
    expect(f.fetcher).not.toHaveBeenCalled()
  })
})

describe('verifyMusicMetadata (production search/lyric)', () => {
  const ok = (f: ReturnType<typeof fixture>, claims = {}, url = searchUrl, method = 'GET') =>
    f.auth().verifyMusicMetadata(url, ORIGIN, 'Bearer ' + f.token({ ...search, ...claims }), method)

  it('accepts search (all types) and lyric targets with their own declarations', async () => {
    const f = fixture()
    for (const type of ['song', 'album', 'playlist'])
      await expect(ok(f, {}, searchUrl + '&type=' + type)).resolves.toBeTruthy()
    const lyric = { htu: config.audience + '/api/music/lyric', query_keys: ['lyricId', 'source'] }
    await expect(ok(f, lyric, '/api/music/lyric?source=tencent&lyricId=fixture')).resolves.toBeTruthy()
  })
  it.each([
    { channel: 'sandbox' },
    { scopes: ['network.websocket'] },
    { htu: config.audience + '/api/music/lyric' },
    { query_keys: ['source', 'keyword'] },
    { query_keys: ['source', 'keyword', 'limit', 'page', 'type', 'url'] },
    { query_keys: ['source', 'keyword', 'limit', 'page', 'page'] },
  ])('rejects invalid claims %#', async (claims) => {
    await expect(ok(fixture(), claims)).rejects.toThrow(REJECTED)
  })
  it.each([
    searchUrl + '&keyword=again',
    searchUrl + '&url=https://evil.test',
    searchUrl + '#fragment',
    '/api/music/url?source=netease&urlId=fixture',
    '/api/rooms',
    '//evil.test' + searchUrl,
  ])('rejects an unreviewed target %# before loading keys', async (raw) => {
    const f = fixture()
    await expect(ok(f, {}, raw)).rejects.toThrow(REJECTED)
    expect(f.fetcher).not.toHaveBeenCalled()
  })
  it('requires GET, the issuer Origin and a Bearer', async () => {
    const f = fixture()
    await expect(ok(f, {}, searchUrl, 'POST')).rejects.toThrow(REJECTED)
    await expect(f.auth().verifyMusicMetadata(searchUrl, 'https://evil.test', 'Bearer x', 'GET')).rejects.toThrow(
      REJECTED,
    )
    await expect(f.auth().verifyMusicMetadata(searchUrl, ORIGIN, undefined, 'GET')).rejects.toThrow(REJECTED)
    expect(f.fetcher).not.toHaveBeenCalled()
  })
})

describe('trusted keys', () => {
  it('rejects untrusted signatures and ignores token-supplied key sources', async () => {
    const f = fixture()
    const other = fixture()
    const auth = f.auth()
    for (const token of [
      other.token(roomSocket, { kid: f.jwk.kid }),
      f.token(roomSocket, { kid: undefined }),
      f.token(roomSocket, { jku: 'https://evil.example/keys', jwk: other.jwk }),
    ]) {
      await expect(auth.verifyRoomSocket(roomSocketUrl(token), ORIGIN)).rejects.toThrow(REJECTED)
    }
    expect(f.fetcher).toHaveBeenCalledTimes(1)
  })

  it('refreshes for an unknown kid at most once per cooldown', async () => {
    const f = fixture()
    const other = fixture()
    let now = epoch
    const auth = f.auth(() => now)
    await auth.verifyRoomSocket(roomSocketUrl(f.token(roomSocket)), ORIGIN)
    for (let i = 0; i < 3; i++)
      await expect(auth.verifyRoomSocket(roomSocketUrl(other.token(roomSocket)), ORIGIN)).rejects.toThrow()
    expect(f.fetcher).toHaveBeenCalledTimes(1)
    now += 10_001
    await expect(auth.verifyRoomSocket(roomSocketUrl(other.token(roomSocket)), ORIGIN)).rejects.toThrow()
    expect(f.fetcher).toHaveBeenCalledTimes(2)
  })

  it('shares one download between concurrent verifications', async () => {
    const f = fixture()
    const auth = f.auth()
    await Promise.all(
      Array.from({ length: 5 }, () => auth.verifyRoomSocket(roomSocketUrl(f.token(roomSocket)), ORIGIN)),
    )
    expect(f.fetcher).toHaveBeenCalledTimes(1)
  })

  it('fails closed once the cache is stale and refresh fails', async () => {
    const f = fixture()
    let now = epoch
    const auth = f.auth(() => now)
    await auth.verifyRoomSocket(roomSocketUrl(f.token(roomSocket)), ORIGIN)
    now += 600_001
    f.fetcher.mockRejectedValue(new Error('upstream unavailable'))
    const later = Math.floor(now / 1000)
    const claims = { ...roomSocket, iat: later, nbf: later, exp: later + 300 }
    await expect(auth.verifyRoomSocket(roomSocketUrl(f.token(claims)), ORIGIN)).rejects.toThrow(REJECTED)
  })

  it('does not fail startup when the best-effort warm-up cannot reach the issuer', async () => {
    const f = fixture()
    f.fetcher.mockRejectedValue(new Error('upstream unavailable'))
    const auth = f.auth()
    await expect(auth.refresh()).rejects.toThrow(REJECTED)
    // The caller swallows the rejection; the first token after the cooldown loads keys lazily.
    f.fetcher.mockImplementation(async () => new Response(JSON.stringify({ keys: [f.jwk] })))
    const later = f.auth(() => epoch + 10_001)
    await expect(later.verifyRoomSocket(roomSocketUrl(f.token(roomSocket)), ORIGIN)).resolves.toBeTruthy()
  })

  it.each([
    ['private key field', { d: 'not-allowed' }],
    ['wrong algorithm', { alg: 'RS256' }],
    ['wrong curve', { crv: 'P-384' }],
    ['mismatched kid', { kid: 'b'.repeat(64) }],
  ])('rejects a JWKS entry with %s', async (_name, change) => {
    const f = fixture()
    f.fetcher.mockResolvedValue(new Response(JSON.stringify({ keys: [{ ...f.jwk, ...change }] })))
    await expect(f.auth().verifyRoomSocket(roomSocketUrl(f.token(roomSocket)), ORIGIN)).rejects.toThrow(REJECTED)
  })

  it('uses an explicit key file without any network fallback', async () => {
    const f = fixture()
    const directory = await mkdtemp(join(tmpdir(), 'music-platform-keys-'))
    directories.push(directory)
    const jwksFile = join(directory, 'jwks.json')
    await writeFile(jwksFile, JSON.stringify({ keys: [f.jwk] }))
    const auth = new PlatformAuth({ ...config, jwksFile }, f.fetcher, () => epoch)
    await expect(auth.verifyRoomSocket(roomSocketUrl(f.token(roomSocket)), ORIGIN)).resolves.toMatchObject({
      sub: '123',
    })
    await rm(jwksFile)
    await expect(new PlatformAuth({ ...config, jwksFile }, f.fetcher, () => epoch).refresh()).rejects.toThrow(REJECTED)
    expect(f.fetcher).not.toHaveBeenCalled()
  })
})

describe('mapPlatformUserId', () => {
  const identity = { iss: 'https://linux.do/forum', sub: '123' }

  it('maps issuer and subject stably into a bounded platform namespace', () => {
    const id = mapPlatformUserId(identity)
    expect(id).toMatch(/^mapp_[a-f0-9]{32}$/)
    expect(mapPlatformUserId({ ...identity })).toBe(id)
    expect(id).not.toBe(identity.sub)
  })

  it('isolates different accounts and communities, including ambiguous concatenations', () => {
    const ids = [
      identity,
      { ...identity, sub: '124' },
      { ...identity, iss: 'https://other.example/forum' },
      { iss: 'https://example.test/1', sub: '23' },
      { iss: 'https://example.test/12', sub: '3' },
    ].map(mapPlatformUserId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not use mutable display names or client-provided identity fields', () => {
    expect(mapPlatformUserId({ ...identity, nickname: 'owner', userId: 'web-owner' } as typeof identity)).toBe(
      mapPlatformUserId(identity),
    )
  })
})

describe('createPlatformResolvers', () => {
  const identity = { iss: 'https://linux.do/forum', sub: '123', userId: 'untrusted', nickname: 'owner' }
  const http = { url: '/x', origin: 'https://linux.do', authorization: 'Bearer fixture', method: 'GET' }

  it('forwards only the server-side inputs and maps the verified account', async () => {
    const auth = {
      verifyRoomSocket: vi.fn().mockResolvedValue(identity),
      verifyRoomMedia: vi.fn().mockResolvedValue(identity),
      verifyMusicMetadata: vi.fn().mockResolvedValue(identity),
    } as unknown as PlatformAuth
    const resolvers = createPlatformResolvers(auth)
    const expected = { userId: mapPlatformUserId(identity) }

    await expect(
      resolvers.roomSocket({ url: '/socket.io/?x', origin: 'https://linux.do', extra: 1 } as never),
    ).resolves.toEqual(expected)
    expect(auth.verifyRoomSocket).toHaveBeenCalledExactlyOnceWith('/socket.io/?x', 'https://linux.do')
    await expect(resolvers.roomMedia(http)).resolves.toEqual(expected)
    expect(auth.verifyRoomMedia).toHaveBeenCalledExactlyOnceWith(http.url, http.origin, http.authorization, http.method)
    await expect(resolvers.musicMetadata(http)).resolves.toEqual(expected)
    expect(auth.verifyMusicMetadata).toHaveBeenCalledExactlyOnceWith(
      http.url,
      http.origin,
      http.authorization,
      http.method,
    )
  })

  it('propagates rejection without manufacturing a Web identity', async () => {
    const rejection = new Error(REJECTED)
    const auth = {
      verifyRoomSocket: vi.fn().mockRejectedValue(rejection),
      verifyRoomMedia: vi.fn().mockRejectedValue(rejection),
      verifyMusicMetadata: vi.fn().mockRejectedValue(rejection),
    } as unknown as PlatformAuth
    const resolvers = createPlatformResolvers(auth)
    await expect(resolvers.roomSocket({ url: '/x', origin: undefined })).rejects.toThrow(REJECTED)
    await expect(resolvers.roomMedia({ ...http, authorization: undefined })).rejects.toThrow(REJECTED)
    await expect(resolvers.musicMetadata({ ...http, origin: undefined })).rejects.toThrow(REJECTED)
  })
})
