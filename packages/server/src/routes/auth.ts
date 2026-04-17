import { Router, type Router as RouterType, type Request, type Response } from 'express'
import { issueIdentityCookie } from '../services/identityService.js'
import { logger } from '../utils/logger.js'

const router: RouterType = Router()

/**
 * Ensure identity cookie exists, and renew expiry on every call.
 * Returns 204 and exposes identity metadata via headers.
 */
router.post('/identity/bootstrap', (req: Request, res: Response) => {
  const hasExistingIdentity = typeof req.identityUserId === 'string' && req.identityUserId.length > 0
  const issued = issueIdentityCookie(req, res, req.identityUserId)
  req.identityUserId = issued.userId
  res.setHeader('Access-Control-Expose-Headers', 'X-Identity-UserId, X-Identity-Expires-At')
  res.setHeader('X-Identity-UserId', issued.userId)
  res.setHeader('X-Identity-Expires-At', String(issued.expiresAt))
  logger.info('Identity bootstrap issued', {
    userId: issued.userId,
    reusedIdentity: hasExistingIdentity,
    expiresAt: issued.expiresAt,
    ip: req.ip,
  })
  res.status(204).send()
})

export default router
