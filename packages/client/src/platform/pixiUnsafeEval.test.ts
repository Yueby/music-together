import '@pixi/unsafe-eval'
import { ShaderSystem } from '@pixi/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('@pixi/unsafe-eval CSP compatibility for mapp', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('bypasses new Function checks in ShaderSystem.systemCheck under strict CSP', () => {
    const fnSpy = vi.spyOn(globalThis, 'Function').mockImplementation(() => {
      throw new Error('Blocked by CSP unsafe-eval')
    })

    // ShaderSystem's constructor invokes systemCheck(), which throws via new Function unless patched.
    expect(() => new ShaderSystem({} as ConstructorParameters<typeof ShaderSystem>[0])).not.toThrow()
    expect(fnSpy).not.toHaveBeenCalled()
  })

  it('replaces the stock per-frame uniform synchronizer', () => {
    const source = ShaderSystem.prototype.syncUniforms.toString()
    expect(source).not.toMatch(/\bnew\s+Function\b|\b(?:createSyncGroups|generateUniformsSync)\b/)
  })
})
