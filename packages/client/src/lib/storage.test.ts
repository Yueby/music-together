// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { SETTING_DEFAULTS, storage } from './storage'

describe('AMLL settings storage', () => {
  beforeEach(() => localStorage.clear())

  it('uses the advanced AMLL defaults', () => {
    expect(storage.getLyricAlignPosition()).toBe(0.5)
    expect(storage.getLyricHidePassedLines()).toBe(false)
    expect(storage.getLyricShowBottomLine()).toBe(true)
    expect(storage.getLyricMaskObsceneWordsMode()).toBe('')
    expect(storage.getBgRenderer()).toBe('pixi')
    expect(storage.getBgStaticMode()).toBe(false)
    expect(storage.getBgReactToLowFreq()).toBe(false)
  })

  it('validates enum and numeric settings loaded from localStorage', () => {
    localStorage.setItem('mt-bgRenderer', 'invalid')
    localStorage.setItem('mt-lyricMaskObsceneWordsMode', 'invalid')
    localStorage.setItem('mt-lyricWordFadeWidth', '100')

    expect(storage.getBgRenderer()).toBe(SETTING_DEFAULTS.bgRenderer)
    expect(storage.getLyricMaskObsceneWordsMode()).toBe(SETTING_DEFAULTS.lyricMaskObsceneWordsMode)
    expect(storage.getLyricWordFadeWidth()).toBe(2)
  })

  it.each([['an object', '{"platform":"netease","cookie":"x"}'], ['a string', '"x"'], ['null', 'null'], ['a number', '5'], ['broken JSON', '{oops']])(
    'reads auth cookies stored as %s as an empty list instead of throwing',
    (_label, raw) => {
      localStorage.setItem('mt-auth-cookies', raw)

      expect(storage.getAuthCookies()).toEqual([])
      expect(storage.hasAuthCookie('netease')).toBe(false)
      expect(() => storage.upsertAuthCookie('tencent', 'fresh')).not.toThrow()
      expect(storage.getAuthCookies()).toEqual([{ platform: 'tencent', cookie: 'fresh' }])
    },
  )

  it('drops malformed auth cookie entries but keeps the valid ones', () => {
    localStorage.setItem(
      'mt-auth-cookies',
      JSON.stringify([
        { platform: 'netease', cookie: 'good' },
        { platform: 'netease' },
        { platform: 'unknown-platform', cookie: 'x' },
        { platform: 1, cookie: 'x' },
        null,
        'text',
        { platform: 'tencent', cookie: 42 },
      ]),
    )

    expect(storage.getAuthCookies()).toEqual([{ platform: 'netease', cookie: 'good' }])
    expect(storage.hasAuthCookie('netease')).toBe(true)
    expect(storage.hasAuthCookie('tencent')).toBe(false)
  })

  it('ignores a rejoin token whose shape is wrong', () => {
    const future = Date.now() + 60_000
    for (const bad of [[], 'x', null, { roomId: 'R', token: 1, expiresAt: future }, { roomId: 'R', token: 't', expiresAt: '9' }]) {
      localStorage.setItem('mt-rejoin-token', JSON.stringify(bad))
      expect(storage.getRejoinToken('R')).toBeNull()
      expect(() => storage.clearRejoinToken('R')).not.toThrow()
    }

    storage.setRejoinToken('R', 'tok', future)
    expect(storage.getRejoinToken('R')).toBe('tok')
  })

  it('persists switches, renderer and mask character', () => {
    storage.setLyricHidePassedLines(true)
    storage.setLyricMaskObsceneWordsMode('partial-mask')
    storage.setLyricMaskObsceneWordChar('#more')
    storage.setBgRenderer('mesh')
    storage.setBgStaticMode(true)
    storage.setBgReactToLowFreq(true)

    expect(storage.getLyricHidePassedLines()).toBe(true)
    expect(storage.getLyricMaskObsceneWordsMode()).toBe('partial-mask')
    expect(storage.getLyricMaskObsceneWordChar()).toBe('#')
    expect(storage.getBgRenderer()).toBe('mesh')
    expect(storage.getBgStaticMode()).toBe(true)
    expect(storage.getBgReactToLowFreq()).toBe(true)
  })
})
