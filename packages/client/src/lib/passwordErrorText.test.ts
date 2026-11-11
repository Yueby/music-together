import { PASSWORD_LOCKED_MESSAGE } from '@music-together/shared'
import { describe, expect, it } from 'vitest'
import { wrongPasswordText } from './passwordErrorText'

describe('wrongPasswordText', () => {
  it('says so when the server turned the join away for too many tries', () => {
    expect(wrongPasswordText(PASSWORD_LOCKED_MESSAGE)).toBe('密码错误次数过多，请稍后再试')
  })

  it('is a plain wrong password otherwise', () => {
    expect(wrongPasswordText('密码错误')).toBe('密码错误，请重试')
    expect(wrongPasswordText(undefined)).toBe('密码错误，请重试')
  })
})
