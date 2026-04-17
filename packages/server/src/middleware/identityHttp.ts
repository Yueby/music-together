import type { Request, Response, NextFunction } from 'express'
import { getIdentityFromRequest, issueIdentityCookie } from '../services/identityService.js'
import { logger } from '../utils/logger.js'

const RENEWAL_LOG_INTERVAL_MS = 5 * 60 * 1000
const RENEWAL_MAP_MAX_SIZE = 10_000
const renewalLogAt = new Map<string, number>()

// 定时清理过期条目，防止 Map 无限增长
const RENEWAL_CLEANUP_INTERVAL_MS = 10 * 60 * 1000
setInterval(() => {
  const threshold = Date.now() - RENEWAL_LOG_INTERVAL_MS
  for (const [userId, lastTime] of renewalLogAt) {
    if (lastTime < threshold) renewalLogAt.delete(userId)
  }
}, RENEWAL_CLEANUP_INTERVAL_MS).unref()

function shouldLogRenewal(userId: string): boolean {
  const now = Date.now()
  const last = renewalLogAt.get(userId) ?? 0
  if (now - last < RENEWAL_LOG_INTERVAL_MS) return false
  // Evict oldest entries if map exceeds size limit
  if (renewalLogAt.size >= RENEWAL_MAP_MAX_SIZE) {
    const firstKey = renewalLogAt.keys().next().value
    if (firstKey) renewalLogAt.delete(firstKey)
  }
  renewalLogAt.set(userId, now)
  return true
}

/**
 * Attach verified identity to request context and refresh cookie expiry
 * (sliding expiration) when token is valid.
 */
export function identityHttpMiddleware(req: Request, res: Response, next: NextFunction): void {
  const identity = getIdentityFromRequest(req)
  if (identity) {
    req.identityUserId = identity.userId
    const issued = issueIdentityCookie(req, res, identity.userId)
    if (shouldLogRenewal(identity.userId)) {
      logger.info('Identity cookie renewed', {
        userId: identity.userId,
        method: req.method,
        path: req.path,
        expiresAt: issued.expiresAt,
      })
    }
  }
  next()
}
