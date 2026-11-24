import compression from 'compression'
import type { Request, RequestHandler, Response } from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { baseLogger } from '../utils/logger.js'

const SENSITIVE_QUERY_KEYS = new Set([
  'mini_app_token',
  'token',
  'cookie',
  'password',
  'secret',
  'key',
  'auth',
  'authorization',
])

const SKIP_COMPRESS_PREFIXES = ['/api/mapp/audio', '/api/mapp/cover', '/api/music/cover-proxy']

const SKIP_LOG_PREFIXES = ['/api/health', '/api/version', '/assets/', '/socket.io/']

/**
 * Strip sensitive query parameters (e.g. `mini_app_token`, `cookie`, `password`) before logging a request URL.
 * Preserves path and non-sensitive query parameters so logs stay diagnostic without ever leaking secrets.
 */
export function sanitizeUrlForLog(rawUrl: string | undefined): string {
  if (!rawUrl) return '/'
  const queryIndex = rawUrl.indexOf('?')
  if (queryIndex < 0) return rawUrl

  try {
    const parsed = new URL(rawUrl, 'http://localhost')
    let changed = false
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]')
        changed = true
      }
    }
    if (!changed) return rawUrl
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return rawUrl.slice(0, queryIndex)
  }
}

/**
 * Security headers tuned for Music Together:
 * - Disables `X-Powered-By`, sets `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `HSTS`, `X-Frame-Options`.
 * - Disables CSP here because the Web SPA loads dynamic external music CDNs, cover hosts, Google Fonts, and PixiJS shaders.
 * - Uses `cross-origin` CORP so cover proxy and Discourse mini-app media routes remain loadable cross-origin.
 */
export function createHelmetMiddleware(): RequestHandler {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
}

/** Decide whether a response should be compressed by Express `compression`. */
export function shouldCompressResponse(req: Request, res: Response): boolean {
  if (req.headers['x-no-compression']) return false
  const urlPath = req.path || req.url.split('?')[0] || ''
  if (SKIP_COMPRESS_PREFIXES.some((prefix) => urlPath.startsWith(prefix))) {
    return false
  }
  const contentType = res.getHeader('Content-Type')
  if (typeof contentType === 'string' && /^(audio|video|image)\//i.test(contentType)) {
    return false
  }
  return compression.filter(req, res)
}

/** Gzip/deflate compression for JSON APIs (lyrics, TTML, search, playlists) and SPA text assets. */
export function createCompressionMiddleware(): RequestHandler {
  return compression({
    threshold: 1024,
    filter: shouldCompressResponse,
  })
}

/** Structured HTTP access logging via `pino-http`, redacting credentials and skipping noisy probes/assets. */
export function createHttpLoggerMiddleware(): RequestHandler {
  return pinoHttp({
    logger: baseLogger,
    autoLogging: {
      ignore: (req) => {
        const url = req.url ?? ''
        return SKIP_LOG_PREFIXES.some((prefix) => url.startsWith(prefix))
      },
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error'
      if (res.statusCode >= 400) return 'warn'
      return 'info'
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: sanitizeUrlForLog(req.url),
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  })
}
