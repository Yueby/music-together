import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const sdkRoot = dirname(require.resolve('@neteasecloudmusicapienhanced/api'))
const registerSource = readFileSync(join(sdkRoot, 'module/register_xeapikey.js'), 'utf8')
const requestSource = readFileSync(join(sdkRoot, 'util/request.js'), 'utf8')
type Key = { publicKey: string; version: string; sk?: unknown }
type Register = (query: Record<string, unknown>, request: null) => Promise<{ status: number; body: Key }>

function setup(key: Key = { publicKey: Buffer.alloc(32, 7).toString('base64'), version: 'fixture-v1' }) {
  const response = {
    data: {
      code: 200,
      data: { encryptedData: 'fixture-ciphertext', signature: 'fixture-signature', timestamp: '1700000000000' },
    },
  }
  const axios = vi.fn().mockResolvedValue(response)
  const decode = vi.fn().mockReturnValue(key)
  const module = { exports: undefined as unknown }
  const mockRequire = (name: string) => {
    if (name === 'axios') return { default: axios }
    if (name === '../util/crypto') return { xeapiSign: () => 'fixture-signature', xeapiDecryptPublicKey: decode }
    if (name === '../util/config.json') return { APP_CONF: { apiDomain: 'https://music.example.test' } }
    throw new Error('Unexpected SDK dependency')
  }
  new Function('require', 'module', 'exports', registerSource)(mockRequire, module, module.exports)
  return { register: module.exports as Register, response, axios, decode }
}

function cacheLoader() {
  const start = requestSource.indexOf('const loadXeapiPublicKey = () => {')
  const end = requestSource.indexOf('// 预先绑定常用函数和常量', start)
  if (start < 0 || end < start) throw new Error('SDK cache loader contract changed')
  const fs = { existsSync: vi.fn().mockReturnValue(true), readFileSync: vi.fn() }
  const load = new Function(
    'fs',
    'xeapiPublicKeyPath',
    'let xeapi_public_key = null;\n' + requestSource.slice(start, end) + '\nreturn loadXeapiPublicKey;',
  )(fs, 'fixture-key-cache') as () => { version: string } | null
  return { load, fs }
}

describe('NetEase SDK signed-key compatibility patch', () => {
  it('accepts the signed public-key response without an optional sk', async () => {
    const { register, axios, decode } = setup()
    const result = await register({ deviceId: 'fixture-device' }, null)
    expect(result.status).toBe(200)
    expect(result.body.version).toBe('fixture-v1')
    expect(result.body.sk).toBeUndefined()
    expect(decode).toHaveBeenCalledWith('fixture-ciphertext')
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://music.example.test/api/bsr/sk/get', proxy: false, timeout: 8000 }),
    )
  })

  it('preserves an optional sk when the signed response includes it', async () => {
    const { register } = setup({
      publicKey: Buffer.alloc(32, 7).toString('base64'),
      version: 'fixture-v2',
      sk: 'fixture-session-state',
    })
    expect((await register({}, null)).body.sk).toBe('fixture-session-state')
  })

  it('rejects a response signature mismatch before decoding key data', async () => {
    const { register, response, decode } = setup()
    response.data.data.signature = 'invalid-signature'
    await expect(register({}, null)).rejects.toThrow('signature mismatch')
    expect(decode).not.toHaveBeenCalled()
  })

  it('rejects a failed business response before decoding key data', async () => {
    const { register, response, decode } = setup()
    response.data.code = 403
    await expect(register({}, null)).rejects.toThrow('request failed')
    expect(decode).not.toHaveBeenCalled()
  })

  it.each([
    { publicKey: 'invalid', version: 'v1' },
    { publicKey: Buffer.alloc(32, 7).toString('base64'), version: {} },
    { publicKey: Buffer.alloc(32, 7).toString('base64'), version: 'v1', sk: 123 },
  ])('rejects malformed signed key state %#', async (value) => {
    const { register } = setup(value as Key)
    await expect(register({}, null)).rejects.toThrow('response invalid')
  })

  it('loads a newly rotated key instead of retaining the previous key', () => {
    const { load, fs } = cacheLoader()
    fs.readFileSync.mockReturnValueOnce('{"version":"v1"}').mockReturnValueOnce('{"version":"v2"}')
    expect(load()?.version).toBe('v1')
    expect(load()?.version).toBe('v2')
    expect(fs.readFileSync).toHaveBeenCalledTimes(2)
  })

  it('does not retain old key state when the cache becomes malformed', () => {
    const { load, fs } = cacheLoader()
    fs.readFileSync.mockReturnValueOnce('{"version":"v1"}').mockReturnValueOnce('{invalid')
    expect(load()?.version).toBe('v1')
    expect(load()).toBeNull()
  })

  it('does not retain old key state after the cache file disappears', () => {
    const { load, fs } = cacheLoader()
    fs.readFileSync.mockReturnValue('{"version":"v1"}')
    fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false)
    expect(load()?.version).toBe('v1')
    expect(load()).toBeNull()
  })

  it('limits SDK failure logging to status and business code', () => {
    expect(requestSource).not.toContain("console.log('[ERR]', answer)")
    expect(requestSource).toContain("console.log('[ERR]', { status: answer.status, code: 502 })")
  })
})
