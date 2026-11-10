import { createHash, createPublicKey, type JsonWebKeyInput, type KeyObject } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { verifyPlatformRequest, verifyPlatformWebSocketRequest } from '@discourse-mini-app/sdk/server'
import { mappRoomMediaQuerySchema, parseMappMetadataRequest } from '@music-together/shared'

export interface PlatformConfig {
  /** Community URL, optionally with a forum subdirectory and no trailing slash. */
  issuer: string
  /** This service's public HTTPS origin; never derived from Host or forwarded headers. */
  audience: string
  appId: string
  /** Operator-supplied trusted JWKS; when set, keys are never downloaded. */
  jwksFile?: string
  /**
   * Also accept sandbox-channel tokens (issued only to the app's author/admins for sandbox builds).
   * Sandbox sessions then share this server's rooms, so enable it for testing only.
   */
  allowSandbox?: boolean
}

const ENV_NAMES = ['MAPP_ISSUER', 'MAPP_AUDIENCE', 'MAPP_APP_ID', 'MAPP_JWKS_FILE'] as const
const SANDBOX_ENV = 'MAPP_ALLOW_SANDBOX'
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function invalidConfig(name: string, reason: string): never {
  // Names only; values may be sensitive paths or identifiers.
  throw new Error(`微应用平台配置无效：${name} ${reason} (invalid mini-app platform configuration: ${name})`)
}

function httpsUrl(name: string, value: string | undefined): URL {
  if (!value) invalidConfig(name, '未设置；MAPP_ISSUER、MAPP_AUDIENCE、MAPP_APP_ID 必须同时设置')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return invalidConfig(name, '不是合法的 URL')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port) {
    invalidConfig(name, '必须是不带凭据、查询、片段和端口的 https 地址')
  }
  return url
}

/**
 * Platform access is opt-in. All `MAPP_*` variables unset → disabled (`undefined`).
 * Anything else must be a complete, valid configuration, otherwise startup fails loudly.
 */
export function readPlatformConfig(env: NodeJS.ProcessEnv = process.env): PlatformConfig | undefined {
  const value = (name: (typeof ENV_NAMES)[number] | typeof SANDBOX_ENV) => env[name]?.trim() || undefined
  const allNames = [...ENV_NAMES, SANDBOX_ENV] as const
  if (allNames.every((name) => !value(name))) return undefined

  const issuer = httpsUrl('MAPP_ISSUER', value('MAPP_ISSUER'))
  const audience = httpsUrl('MAPP_AUDIENCE', value('MAPP_AUDIENCE'))
  if (audience.pathname !== '/') invalidConfig('MAPP_AUDIENCE', '只能是 origin，不能带路径')
  if (audience.hostname === issuer.hostname) invalidConfig('MAPP_AUDIENCE', '的主机名不能与论坛相同')
  const appId = value('MAPP_APP_ID')
  if (!appId || !UUID_V7.test(appId)) invalidConfig('MAPP_APP_ID', '必须是平台分配的 UUIDv7')
  const jwksFile = value('MAPP_JWKS_FILE')
  if (jwksFile && !isAbsolute(jwksFile)) invalidConfig('MAPP_JWKS_FILE', '必须是绝对路径')
  const sandbox = value(SANDBOX_ENV)
  if (sandbox !== undefined && sandbox !== 'true' && sandbox !== 'false') {
    invalidConfig(SANDBOX_ENV, '只能是 true 或 false')
  }

  return {
    issuer: issuer.href.endsWith('/') ? issuer.href.slice(0, -1) : issuer.href,
    audience: audience.origin,
    appId,
    ...(jwksFile ? { jwksFile } : {}),
    ...(sandbox === 'true' ? { allowSandbox: true } : {}),
  }
}

/** Every rejection looks the same to callers; details never leave this module. */
function fail(): never {
  throw new Error('Platform authentication rejected')
}
async function sanitized<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch {
    return fail()
  }
}

const KEY_TTL_MS = 600_000
const REFRESH_COOLDOWN_MS = 10_000
const ROOM_SOCKET_URL = /^\/socket\.io\/\?EIO=4&transport=websocket&mini_app_token=([A-Za-z0-9_.-]+)$/
const ROOM_SOCKET_HTU = '/socket.io/?EIO=4&transport=websocket'
const ROOM_MEDIA_PATH = '/api/mapp/audio'

type Jwk = JsonWebKeyInput['key'] & { kid?: string; alg?: string }

/**
 * Verifies platform JWTs (production, plus sandbox when explicitly allowed). Signatures, claims and expiry are checked by the official SDK;
 * this class chooses the trusted public key and pins the exact endpoint each caller may use.
 */
export class PlatformAuth {
  private keys = new Map<string, KeyObject>()
  private loadedAt = -Infinity
  private attemptedAt = -Infinity
  private loading: Promise<void> | undefined
  private readonly origin: string

  constructor(
    readonly config: PlatformConfig,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    this.origin = new URL(config.issuer).origin
  }

  /** One download at a time, at most one attempt per cooldown. Failure leaves the old keys to expire. */
  refresh(): Promise<void> {
    if (!this.loading) {
      if (this.now() - this.attemptedAt < REFRESH_COOLDOWN_MS) return Promise.resolve()
      this.attemptedAt = this.now()
      this.loading = this.download().finally(() => {
        this.loading = undefined
      })
    }
    return this.loading
  }

  private async download(): Promise<void> {
    await sanitized(async () => {
      const body = this.config.jwksFile ? await readFile(this.config.jwksFile, 'utf8') : await this.fetchJwks()
      const { keys } = JSON.parse(body) as { keys?: Jwk[] }
      if (!Array.isArray(keys) || !keys.length) fail()
      const next = new Map<string, KeyObject>()
      for (const jwk of keys) {
        if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || jwk.alg !== 'ES256' || 'd' in jwk) fail()
        const key = createPublicKey({ key: jwk, format: 'jwk' })
        // The kid is the SPKI fingerprint, so a key file cannot relabel one key as another.
        const kid = createHash('sha256')
          .update(key.export({ type: 'spki', format: 'der' }))
          .digest('hex')
        if (jwk.kid !== kid) fail()
        next.set(kid, key)
      }
      this.keys = next
      this.loadedAt = this.now()
    })
  }

  private async fetchJwks(): Promise<string> {
    const response = await this.fetcher(this.config.issuer + '/mini-app-api/jwks', {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) fail()
    return response.text()
  }

  /** Only the kid is read before verification, solely to pick one of this issuer's trusted keys. */
  private async keyFor(token: string): Promise<KeyObject> {
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as { kid?: unknown }
    const kid = typeof header.kid === 'string' ? header.kid : fail()
    const fresh = () => this.now() - this.loadedAt < KEY_TTL_MS
    if (!this.keys.has(kid) || !fresh()) await this.refresh()
    const key = this.keys.get(kid)
    return key && fresh() ? key : fail()
  }

  /** Production first; sandbox tokens only when explicitly allowed. Both are fully verified by the SDK. */
  private async inChannels<T>(verify: (channel: 'production' | 'sandbox') => Promise<T>): Promise<T> {
    try {
      return await verify('production')
    } catch (error) {
      if (!this.config.allowSandbox) throw error
      return verify('sandbox')
    }
  }

  private async verifyBearer(authorization: string, rawUrl: string) {
    const { issuer, audience, appId } = this.config
    const publicKey = await this.keyFor(authorization.slice('Bearer '.length))
    return this.inChannels((channel) =>
      verifyPlatformRequest({
        issuer,
        audience,
        appId,
        publicKey,
        authorization,
        scope: 'network.request',
        method: 'GET',
        // Never derive the externally visible origin from Host or forwarded headers.
        url: audience + rawUrl,
        channel,
        now: Math.floor(this.now() / 1000),
      }),
    )
  }

  /** Socket.IO handshake: `/socket.io/?EIO=4&transport=websocket&mini_app_token=…`. */
  verifyRoomSocket(rawUrl: string, origin: string | undefined) {
    return sanitized(async () => {
      // One exact shape: fixed query, then the platform's sole token. Anything else is rejected before key loading.
      const token = origin === this.origin ? ROOM_SOCKET_URL.exec(rawUrl)?.[1] : undefined
      if (!token) fail()
      const { issuer, audience, appId } = this.config
      const publicKey = await this.keyFor(token)
      const identity = await this.inChannels((channel) =>
        verifyPlatformWebSocketRequest({
          issuer,
          audience,
          appId,
          publicKey,
          channel,
          url: audience + rawUrl,
          now: Math.floor(this.now() / 1000),
        }),
      )
      if (identity.htu !== audience + ROOM_SOCKET_HTU || identity.query_keys.length !== 0) fail()
      return identity
    })
  }

  /** `roomAudio` endpoint; never reads a Web Cookie. */
  verifyRoomMedia(rawUrl: string, origin: string | undefined, authorization: string | undefined, method: string) {
    return sanitized(async () => {
      if (
        origin !== this.origin ||
        method !== 'GET' ||
        !rawUrl.startsWith(ROOM_MEDIA_PATH + '?') ||
        /[#\\]/.test(rawUrl) ||
        !authorization?.startsWith('Bearer ')
      )
        fail()
      const entries = [...new URL(this.config.audience + rawUrl).searchParams]
      if (entries.length !== 2) fail()
      mappRoomMediaQuerySchema.parse(Object.fromEntries(entries))
      const identity = await this.verifyBearer(authorization, rawUrl)
      if (
        identity.htu !== this.config.audience + ROOM_MEDIA_PATH ||
        [...identity.query_keys].sort().join() !== 'roomId,trackId'
      )
        fail()
      return identity
    })
  }

  /** `musicSearch` / `musicLyric` endpoints; only a header Bearer can authenticate them. */
  verifyMusicMetadata(rawUrl: string, origin: string | undefined, authorization: string | undefined, method: string) {
    return sanitized(async () => {
      const { target } = parseMappMetadataRequest(rawUrl)
      if (origin !== this.origin || method !== 'GET' || !authorization?.startsWith('Bearer ')) fail()
      const identity = await this.verifyBearer(authorization, rawUrl)
      const declared = new Set(identity.query_keys)
      if (
        identity.htu !== this.config.audience + target.path ||
        declared.size !== identity.query_keys.length ||
        declared.size !== target.queryKeys.length ||
        target.queryKeys.some((key) => !declared.has(key))
      )
        fail()
      return identity
    })
  }
}

/** Community accounts occupy a namespace separate from server-generated Web identities. */
export function mapPlatformUserId(identity: { iss: string; sub: string }): string {
  return (
    'mapp_' +
    createHash('sha256')
      .update(identity.iss + '\0' + identity.sub)
      .digest('hex')
      .slice(0, 32)
  )
}

export interface PlatformHttpInput {
  url: string
  origin: string | undefined
  authorization: string | undefined
  method: string
}

/**
 * Adapters from a verified issuer/subject to the stable `mapp_` ID the room controllers use.
 * Rejections propagate unchanged: there is no Cookie or client-supplied identity fallback.
 */
export function createPlatformResolvers(auth: PlatformAuth) {
  const toUser = (identity: { iss: string; sub: string }) => ({ userId: mapPlatformUserId(identity) })
  return {
    roomSocket: async ({ url, origin }: { url: string; origin: string | undefined }) =>
      toUser(await auth.verifyRoomSocket(url, origin)),
    roomMedia: async ({ url, origin, authorization, method }: PlatformHttpInput) =>
      toUser(await auth.verifyRoomMedia(url, origin, authorization, method)),
    musicMetadata: async ({ url, origin, authorization, method }: PlatformHttpInput) =>
      toUser(await auth.verifyMusicMetadata(url, origin, authorization, method)),
  }
}
