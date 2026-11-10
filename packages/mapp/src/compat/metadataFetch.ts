import '../cspValidation.ts'
import type { HttpResponse, MiniAppSDK } from '@discourse-mini-app/sdk'
import { MAPP_METADATA_MAX_BYTES, parseMappMetadataRequest } from '@music-together/shared'
import type { MetadataFetch, MetadataResponse } from '../../../client/src/lib/MetadataTransport'

type MetadataSDK = {
  http: Pick<MiniAppSDK['http'], 'request'>
  permissions: Pick<MiniAppSDK['permissions'], 'has'>
}

type Failure =
  | 'METADATA_ORIGIN_REJECTED'
  | 'METADATA_TARGET_REJECTED'
  | 'METADATA_INIT_REJECTED'
  | 'METADATA_PERMISSION_DENIED'
  | 'METADATA_RESPONSE_REJECTED'
  | 'METADATA_TOO_LARGE'
  | 'METADATA_REQUEST_FAILED'
  | 'TIMEOUT'

const failure = (code: Failure) => new Error(code)
const cancelled = () => new DOMException('METADATA_CANCELLED', 'AbortError')
const TIMEOUT_MS = 20_000
const JSON_CONTENT_TYPE = /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i

/** Accept only an explicit https origin; paths, credentials and ports are configuration errors. */
function reviewedHTTPSOrigin(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw failure('METADATA_ORIGIN_REJECTED')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || value !== url.origin) {
    throw failure('METADATA_ORIGIN_REJECTED')
  }
  return url.origin
}

/** Same-origin absolute URL or origin-relative path; the shared parser enforces path and query. */
function parseTarget(input: string, origin: string) {
  try {
    // Keep the raw path so the shared parser can reject normalization tricks.
    const rawPath = input.startsWith('/') ? input : input.startsWith(`${origin}/`) ? input.slice(origin.length) : ''
    return parseMappMetadataRequest(rawPath)
  } catch {
    throw failure('METADATA_TARGET_REJECTED')
  }
}

function sdkFailure(error: unknown): Error {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  if (
    code === 'APP_UNLOADED' ||
    code === 'USER_CANCELLED' ||
    (error instanceof DOMException && error.name === 'AbortError')
  ) {
    return cancelled()
  }
  if (code === 'TIMEOUT') return failure('TIMEOUT')
  if (code === 'PERMISSION_DENIED') return failure('METADATA_PERMISSION_DENIED')
  return failure('METADATA_REQUEST_FAILED')
}

function toMetadataResponse(response: HttpResponse<Uint8Array>): MetadataResponse {
  const contentType = Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1]
  if (!contentType || !JSON_CONTENT_TYPE.test(contentType)) throw failure('METADATA_RESPONSE_REJECTED')
  if (response.body.byteLength > MAPP_METADATA_MAX_BYTES) throw failure('METADATA_TOO_LARGE')
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(response.body)
    const json: unknown = JSON.parse(text)
    const { status } = response
    return { status, ok: status >= 200 && status < 300, json: async () => json, text: async () => text }
  } catch {
    throw failure('METADATA_RESPONSE_REJECTED')
  }
}

/** Read-only, reviewed metadata endpoints. This never installs or falls back to native fetch. */
export function createMappMetadataFetch({
  sdk,
  reviewedOrigin,
}: {
  sdk: MetadataSDK
  reviewedOrigin: string
}): MetadataFetch {
  const origin = reviewedHTTPSOrigin(reviewedOrigin)

  return async (input, init) => {
    if (init?.method !== undefined && init.method !== 'GET') throw failure('METADATA_INIT_REJECTED')
    const parsed = parseTarget(input, origin)
    const upstream = init?.signal
    if (upstream?.aborted) throw cancelled()
    if (!sdk.permissions.has('network.request')) throw failure('METADATA_PERMISSION_DENIED')

    const controller = new AbortController()
    let reason: Error | undefined
    const stop = (error: Error) => {
      reason ??= error
      controller.abort()
    }
    // Settle locally even when the SDK ignores abort and never settles its promise.
    const aborted = new Promise<never>((_, reject) =>
      controller.signal.addEventListener('abort', () => reject(reason), { once: true }),
    )
    const onUpstreamAbort = () => stop(cancelled())
    upstream?.addEventListener('abort', onUpstreamAbort, { once: true })
    const timer = setTimeout(() => stop(failure('TIMEOUT')), TIMEOUT_MS)

    let response: HttpResponse<Uint8Array>
    try {
      response = await Promise.race([
        sdk.http.request(parsed.target.endpoint, {
          method: 'GET',
          // The SDK wire query uses strings; defaults and validation belong to the shared parser.
          query: Object.fromEntries(Object.entries(parsed.query).map(([key, value]) => [key, String(value)])),
          responseType: 'bytes',
          signal: controller.signal,
          timeoutMs: TIMEOUT_MS,
          onDownloadProgress: ({ loaded, total }) => {
            if (loaded > MAPP_METADATA_MAX_BYTES || (total ?? 0) > MAPP_METADATA_MAX_BYTES) {
              stop(failure('METADATA_TOO_LARGE'))
            }
          },
        }),
        aborted,
      ])
    } catch (error) {
      throw reason ?? sdkFailure(error)
    } finally {
      clearTimeout(timer)
      upstream?.removeEventListener('abort', onUpstreamAbort)
    }
    return toMetadataResponse(response)
  }
}
