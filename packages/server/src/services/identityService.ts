import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

export const IDENTITY_COOKIE_NAME = 'mt_identity'
const IDENTITY_TOKEN_VERSION = 1

interface IdentityPayload {
  uid: string
  iat: number
  exp: number
  ver: number
}

type IdentitySource = 'http' | 'socket'

function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(unsignedToken: string): string {
  return createHmac('sha256', config.identity.secret).update(unsignedToken).digest('base64url')
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {}
  const result: Record<string, string> = {}
  for (const chunk of cookieHeader.split(';')) {
    const [k, ...rest] = chunk.trim().split('=')
    if (!k) continue
    const rawValue = rest.join('=') || ''
    try {
      result[k] = decodeURIComponent(rawValue)
    } catch {
      result[k] = rawValue
    }
  }
  return result
}

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true

  const forwardedProto = req.headers['x-forwarded-proto']
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto
  return typeof proto === 'string' && proto.split(',')[0].trim().toLowerCase() === 'https'
}

function serializeIdentityCookie(token: string, secure: boolean): string {
  const maxAgeSec = config.identity.ttlDays * 24 * 60 * 60
  const attrs = [`${IDENTITY_COOKIE_NAME}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', `Max-Age=${maxAgeSec}`]
  attrs.push('SameSite=Lax')
  if (secure) attrs.push('Secure')
  return attrs.join('; ')
}

function issueToken(userId: string): { token: string; payload: IdentityPayload } {
  const now = Date.now()
  const payload: IdentityPayload = {
    uid: userId,
    iat: now,
    exp: now + config.identity.ttlDays * 24 * 60 * 60 * 1000,
    ver: IDENTITY_TOKEN_VERSION,
  }
  const encodedPayload = base64urlEncode(JSON.stringify(payload))
  const unsigned = encodedPayload
  const signature = sign(unsigned)
  return { token: `${unsigned}.${signature}`, payload }
}

export function generateIdentityUserId(): string {
  return nanoid(20)
}

export function issueIdentityCookie(req: Request, res: Response, userId?: string): { userId: string; expiresAt: number } {
  const uid = userId ?? generateIdentityUserId()
  const { token, payload } = issueToken(uid)
  const secure = config.identity.cookieSecure ?? (config.isProd && isSecureRequest(req))
  res.setHeader('Set-Cookie', serializeIdentityCookie(token, secure))
  return { userId: uid, expiresAt: payload.exp }
}

function logTokenInvalid(source: IdentitySource, reason: string, extra?: Record<string, unknown>): void {
  logger.warn('Identity token verification failed', { source, reason, ...extra })
}

export function verifyIdentityToken(token: string, source: IdentitySource): IdentityPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) {
    logTokenInvalid(source, 'invalid_parts', { parts: parts.length })
    return null
  }

  const [encodedPayload, encodedSignature] = parts
  if (!encodedPayload || !encodedSignature) {
    logTokenInvalid(source, 'missing_payload_or_signature')
    return null
  }

  const expectedSignature = sign(encodedPayload)
  const expectedBuffer = Buffer.from(expectedSignature)
  const actualBuffer = Buffer.from(encodedSignature)
  if (expectedBuffer.length !== actualBuffer.length) {
    logTokenInvalid(source, 'signature_length_mismatch')
    return null
  }
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
    logTokenInvalid(source, 'signature_mismatch')
    return null
  }

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload)) as IdentityPayload
    if (payload.ver !== IDENTITY_TOKEN_VERSION) {
      logTokenInvalid(source, 'version_mismatch', { version: payload.ver })
      return null
    }
    if (typeof payload.uid !== 'string' || payload.uid.length === 0) {
      logTokenInvalid(source, 'invalid_uid')
      return null
    }
    if (!Number.isFinite(payload.exp)) {
      logTokenInvalid(source, 'invalid_exp')
      return null
    }
    if (payload.exp <= Date.now()) {
      logTokenInvalid(source, 'expired_token', { userId: payload.uid, exp: payload.exp })
      return null
    }
    return payload
  } catch {
    logTokenInvalid(source, 'invalid_payload_json')
    return null
  }
}

export function getIdentityFromRequest(req: Request): { userId: string } | null {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[IDENTITY_COOKIE_NAME]
  if (!token) return null
  const payload = verifyIdentityToken(token, 'http')
  if (!payload) return null
  return { userId: payload.uid }
}

export function getIdentityFromCookieHeader(cookieHeader?: string): { userId: string } | null {
  const token = parseCookies(cookieHeader)[IDENTITY_COOKIE_NAME]
  if (!token) return null
  const payload = verifyIdentityToken(token, 'socket')
  if (!payload) return null
  return { userId: payload.uid }
}
