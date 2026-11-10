import { randomUUID } from 'node:crypto'
import { rename, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AudioQuality } from '@music-together/shared'
import ncmApi from '@neteasecloudmusicapienhanced/api'
import { logger } from '../utils/logger.js'
import { isStreamUrlExpired } from './streamUrlLifetime.js'

const TIMEOUT_MS = 8_000
const PROBE_BYTES = 4_096
const LEVELS: Record<AudioQuality, string> = {
  128: 'standard',
  192: 'exhigh',
  320: 'exhigh',
  999: 'lossless',
}

interface PublicKeyState {
  publicKey: string
  version: string
  nextUpdateTime: number
  sk?: string
}

let refreshAt = 0
let keyRegistration: Promise<void> | undefined

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function validateKey(value: unknown): PublicKeyState | null {
  const key = record(value)
  if (
    !key ||
    typeof key.publicKey !== 'string' ||
    !/^[A-Za-z0-9+/]{43}=$/.test(key.publicKey) ||
    Buffer.from(key.publicKey, 'base64').length !== 32 ||
    Buffer.from(key.publicKey, 'base64').toString('base64') !== key.publicKey ||
    typeof key.version !== 'string' ||
    !/^[A-Za-z0-9._-]{1,128}$/.test(key.version) ||
    typeof key.nextUpdateTime !== 'number' ||
    !Number.isSafeInteger(key.nextUpdateTime) ||
    key.nextUpdateTime <= Date.now() ||
    ('sk' in key && typeof key.sk !== 'string')
  )
    return null

  return {
    publicKey: key.publicKey,
    version: key.version,
    nextUpdateTime: key.nextUpdateTime,
    ...('sk' in key ? { sk: key.sk as string } : {}),
  }
}

async function registerKey(): Promise<void> {
  // Only the public registration endpoint verifies the response signature. Never trust a disk cache as initialization.
  const result = record(await ncmApi.register_xeapikey({ timeout: TIMEOUT_MS }))
  const key = result?.status === 200 ? validateKey(result.body) : null
  if (!key) throw new Error('Invalid public key')

  const cachePath = join(tmpdir(), 'xeapi_public_key')
  const temporaryPath = `${cachePath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, JSON.stringify(key), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await rename(temporaryPath, cachePath)
  } finally {
    await unlink(temporaryPath).catch(() => {})
  }
  const now = Date.now()
  if (key.nextUpdateTime <= now) throw new Error('Expired public key')
  refreshAt = key.nextUpdateTime - Math.min(60_000, (key.nextUpdateTime - now) / 10)
}

async function ensureKey(): Promise<void> {
  if (keyRegistration) return keyRegistration
  if (Date.now() < refreshAt) return
  refreshAt = 0
  keyRegistration = registerKey()
  try {
    await keyRegistration
  } finally {
    keyRegistration = undefined
  }
}

function safeCdnUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !/^https?:\/\//.test(value) || /[\s\\]/.test(value)) return null
  try {
    const candidate = value.replace(/^http:/, 'https:')
    const url = new URL(candidate)
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+music\.126\.net$/.test(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    )
      return null
    // Preserve the signature byte-for-byte; only upgrade the transport protocol.
    return candidate
  } catch {
    return null
  }
}

function hasAudioHeader(bytes: Uint8Array): boolean {
  const header = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (header.length >= 10 && header.toString('ascii', 0, 3) === 'ID3') {
    return header[3]! >= 2 && header[3]! <= 4 && header.subarray(6, 10).every((byte) => byte < 128)
  }
  if (header.length >= 4 && header[0] === 0xff && (header[1]! & 0xe0) === 0xe0) {
    const version = (header[1]! >> 3) & 3
    const layer = (header[1]! >> 1) & 3
    const bitrate = header[2]! >> 4
    const sampleRate = (header[2]! >> 2) & 3
    return version !== 1 && layer !== 0 && bitrate > 0 && bitrate < 15 && sampleRate !== 3
  }
  if (header.length < 12) return false
  return (
    header.toString('ascii', 0, 4) === 'fLaC' ||
    header.toString('ascii', 0, 4) === 'OggS' ||
    (header.readUInt32BE(0) >= 12 && header.toString('ascii', 4, 8) === 'ftyp') ||
    (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WAVE')
  )
}

async function probeAudio(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
      redirect: 'manual',
      signal: controller.signal,
    })
    reader = response.body?.getReader()
    if (
      (response.status !== 200 && response.status !== 206) ||
      response.redirected ||
      (response.url && safeCdnUrl(response.url) !== url) ||
      /(?:text\/|html|json|xml)/i.test(response.headers.get('content-type') ?? '') ||
      !reader
    )
      return false

    const header = new Uint8Array(PROBE_BYTES)
    let length = 0
    // Stop even if an upstream sends empty chunks indefinitely or ignores the Range header.
    for (let reads = 0; reads < 32 && length < PROBE_BYTES; reads++) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = value.subarray(0, PROBE_BYTES - length)
      header.set(chunk, length)
      length += chunk.length
      if (length >= 16) break
    }
    return hasAudioHeader(header.subarray(0, length))
  } finally {
    controller.abort()
    clearTimeout(timer)
    // Do not let a broken upstream's cancellation acknowledgement extend the probe deadline.
    void reader?.cancel().catch(() => {})
  }
}

/** Resolve an authenticated full track without caching account-specific playback URLs. */
export async function getNeteasePlaybackUrl(id: string, bitrate: number, cookie: string): Promise<string | null> {
  if (!cookie || !/^\d+$/.test(id) || !Object.hasOwn(LEVELS, bitrate)) return null
  try {
    await ensureKey()
    const response = record(
      await ncmApi.song_url_v1({
        id,
        level: LEVELS[bitrate as AudioQuality],
        cookie,
        timeout: TIMEOUT_MS,
        randomCNIP: false,
      }),
    )
    const body = record(response?.body)
    if (response?.status !== 200 || body?.code !== 200 || !Array.isArray(body.data)) return null
    const song = body.data.map(record).find((item) => item && String(item.id) === id)
    if (!song || song.code !== 200 || song.freeTrialInfo !== null) return null
    const url = safeCdnUrl(song.url)
    if (!url || isStreamUrlExpired('netease', url) || !(await probeAudio(url))) return null
    return isStreamUrlExpired('netease', url) ? null : url
  } catch (error) {
    if (error instanceof Error && error.message === 'xeapi public key is missing') refreshAt = 0
    // SDK/fetch errors can embed credentials and signed URLs. Never pass them to the logger.
    logger.warn('netease_playback_failed')
    return null
  }
}
