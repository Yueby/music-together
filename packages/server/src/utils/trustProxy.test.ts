import express from 'express'
import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { parseTrustProxy, resolveSocketClientIp } from './trustProxy.js'

describe('parseTrustProxy', () => {
  it.each([undefined, '', '   '])('trusts one reverse proxy by default (%j)', (raw) => {
    expect(parseTrustProxy(raw)).toBe(1)
  })

  it.each([
    ['false', false],
    ['FALSE', false],
    ['true', true],
    [' True ', true],
    ['0', 0],
    ['2', 2],
  ])('reads %j as %j', (raw, expected) => {
    expect(parseTrustProxy(raw)).toBe(expected)
  })

  it('passes Express subnet names and lists through unchanged', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback')
    expect(parseTrustProxy('10.0.0.0/8, 172.16.0.0/12')).toBe('10.0.0.0/8, 172.16.0.0/12')
  })
})

describe('resolveSocketClientIp', () => {
  it.each([
    [false, '127.0.0.1'],
    [1, '198.51.100.20'],
    [2, '203.0.113.10'],
    ['loopback', '198.51.100.20'],
  ])('resolves the handshake IP with Express trust proxy set to %j', (trustProxy, expected) => {
    const app = express().set('trust proxy', trustProxy)
    const request = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.20' },
    } as IncomingMessage
    expect(resolveSocketClientIp(app, request)).toBe(expected)
  })
})
