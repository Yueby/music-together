import { describe, expect, it } from 'vitest'
import { parseTrustProxy } from './trustProxy.js'

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
