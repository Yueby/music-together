import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import type { Request } from 'express'

function identityOrIp(req: Request): string {
  return req.identityUserId ? `identity:${req.identityUserId}` : `ip:${ipKeyGenerator(req.ip ?? '', 56)}`
}

function ipOnly(req: Request): string {
  return `ip:${ipKeyGenerator(req.ip ?? '', 56)}`
}

/**
 * Handing out a brand-new identity must cost something: every other limit is per identity, so a script that can mint
 * identities for free steps around all of them. Keyed by IP only (the caller has no identity yet) — which needs
 * `trust proxy` to be right behind a reverse proxy. Requests that already carry a valid identity just renew its
 * cookie and are not counted, so people sharing one IP (a school, an office) are not affected by each other's visits.
 */
export const identityBootstrapRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: ipOnly,
  skip: (req) => typeof req.identityUserId === 'string' && req.identityUserId.length > 0,
  message: { error: 'Too many identity requests' },
})

export const musicApiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: identityOrIp,
  message: { error: 'Too many music API requests' },
})

/** The room pre-check is anonymous and answers with a room's name and head count: it must not be enumerable. */
export const roomCheckRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: identityOrIp,
  message: { error: 'Too many room checks' },
})

/** Platform (mini-app) audio streams: each request proxies up to 32 MiB from a music CDN. */
export const mediaStreamRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: identityOrIp,
  message: { code: 'MEDIA_RATE_LIMIT' },
})

export const coverProxyRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: identityOrIp,
  message: { error: 'Too many cover requests' },
})
