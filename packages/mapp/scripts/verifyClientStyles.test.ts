import { describe, expect, it } from 'vitest'
import { verifyClientStyles } from './verifyClientStyles.ts'

const utilities = '.flex{display:flex}.grid{display:grid}.items-center{align-items:center}.inline-flex{display:inline-flex}.px-4{padding-inline:1rem}.text-sm{font-size:.875rem}'

describe('generated client stylesheet packaging gate', () => {
  it('accepts generated core utility rules as text or UTF-8 bytes', () => {
    expect(() => verifyClientStyles(utilities)).not.toThrow()
    expect(() => verifyClientStyles(new TextEncoder().encode(utilities))).not.toThrow()
  })
  it.each(['', 'body{color:white;background:black}', '/* ' + utilities + ' */ body{box-sizing:border-box}',
    utilities.replace('.flex{display:flex}', '.flex{display:block}'),
    utilities.replace('.grid{display:grid}', '.grid{display:block}'),
    utilities.replace('.text-sm{font-size:.875rem}', '.text-small{font-size:.875rem}'),
  ])('rejects missing or nonfunctional utility output %#', (css) => {
    expect(() => verifyClientStyles(css)).toThrow('CLIENT_STYLES_INCOMPLETE')
  })
})
