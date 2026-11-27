import { describe, expect, it } from 'vitest'
import { randomMainlandIp } from './mainlandIp.js'

describe('randomMainlandIp', () => {
  it('stays inside 112.88.0.0 - 112.89.35.255', () => {
    expect(randomMainlandIp(() => 0)).toBe('112.88.0.0')
    expect(randomMainlandIp(() => 0.9999999)).toBe('112.89.35.255')
    for (let i = 0; i < 200; i++) expect(randomMainlandIp()).toMatch(/^112\.(88|89)\.\d{1,3}\.\d{1,3}$/)
  })
})
