import type { Response } from 'express'
import { withTimeout } from '../utils/withTimeout.js'

const AUTH_TIMEOUT_MS = 6_000
const MAX_AUTHORIZATION_LENGTH = 8_199
const BEARER_TOKEN = /^Bearer [A-Za-z0-9_.-]+$/
const PLATFORM_USER_ID = /^mapp_[a-f0-9]{32}$/
const ALLOW_HEADERS = 'Authorization, Content-Type'
export const PREFLIGHT_HEADERS = ALLOW_HEADERS.toLowerCase().split(', ')
export const MAPP_PREFLIGHT_MAX_AGE = '86400'

export interface PlatformIdentityInput {
  url: string
  origin: string | undefined
  authorization: string | undefined
  method: string
}

export function setPlatformCorsHeaders(res: Response, origin: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS)
}

export async function verifyPlatformCaller(
  input: PlatformIdentityInput,
  verifyIdentity: (input: PlatformIdentityInput) => Promise<{ userId: string }>,
  unauthorized: Error,
  bearerFormat: 'prefix' | 'strict',
): Promise<string> {
  const { authorization } = input
  if (!authorization || authorization.length > MAX_AUTHORIZATION_LENGTH) throw unauthorized
  // Media accepts the Bearer prefix and delegates token validation to the identity verifier.
  const validBearer = bearerFormat === 'prefix' ? authorization.startsWith('Bearer ') : BEARER_TOKEN.test(authorization)
  if (!validBearer) throw unauthorized

  const identity = await withTimeout(
    Promise.resolve().then(() => verifyIdentity(input)),
    AUTH_TIMEOUT_MS,
    unauthorized,
  ).catch(() => {
    throw unauthorized
  })
  if (!PLATFORM_USER_ID.test(identity?.userId)) throw unauthorized
  return identity.userId
}
