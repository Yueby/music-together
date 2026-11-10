import { describe, expect, it } from 'vitest'
import { usesMeshRenderer } from './backgroundRenderer'

describe('usesMeshRenderer', () => {
  it('follows the user setting on hosts that allow PixiJS', () => {
    expect(usesMeshRenderer('pixi', { pixiBackground: true })).toBe(false)
    expect(usesMeshRenderer('mesh', { pixiBackground: true })).toBe(true)
  })

  it('always uses the mesh renderer where PixiJS cannot run', () => {
    expect(usesMeshRenderer('pixi', { pixiBackground: false })).toBe(true)
    expect(usesMeshRenderer('mesh', { pixiBackground: false })).toBe(true)
  })
})
