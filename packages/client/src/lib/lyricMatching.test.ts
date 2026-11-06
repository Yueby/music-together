import { parseLrc } from '@applemusic-like-lyrics/lyric'
import { describe, expect, it } from 'vitest'
import { findClosestLyricLine } from './lyricMatching'

describe('findClosestLyricLine', () => {
  it('matches exact line when adjacent short sentences are within the 500ms window', () => {
    const candidates = [
      { startTime: 10000, text: '第一句翻译' },
      { startTime: 10400, text: '第二句翻译' },
    ]

    const match = findClosestLyricLine(candidates, 10400)
    expect(match?.text).toBe('第二句翻译')
  })

  it('selects the closest candidate when candidates are out of order', () => {
    const candidates = [
      { startTime: 10450, text: '候选A 差450ms' },
      { startTime: 10050, text: '候选B 差50ms' },
      { startTime: 9800, text: '候选C 差200ms' },
    ]

    const match = findClosestLyricLine(candidates, 10000)
    expect(match?.text).toBe('候选B 差50ms')
  })

  it('handles window boundaries correctly', () => {
    const onBoundary = [{ startTime: 10500, text: '边界内' }]
    const outsideBoundary = [{ startTime: 10501, text: '边界外' }]

    expect(findClosestLyricLine(onBoundary, 10000)?.text).toBe('边界内')
    expect(findClosestLyricLine(outsideBoundary, 10000)).toBeUndefined()
  })

  it('stably chooses the first candidate when distances are identical', () => {
    const candidates = [
      { startTime: 9900, text: '首个候选 差100ms' },
      { startTime: 10100, text: '后选候选 差100ms' },
    ]

    const match = findClosestLyricLine(candidates, 10000)
    expect(match?.text).toBe('首个候选 差100ms')
  })

  it('returns undefined for empty candidates or when all are outside window', () => {
    expect(findClosestLyricLine([], 10000)).toBeUndefined()
    expect(findClosestLyricLine([{ startTime: 20000, text: '远' }], 10000)).toBeUndefined()
  })

  it('matches actual lyrics parsed by parseLrc', () => {
    const lrc = '[00:10.00]First line\n[00:10.40]Second line'
    const parsed = parseLrc(lrc)

    const match = findClosestLyricLine(parsed, 10400)
    expect(match?.words.map((w) => w.word).join('')).toBe('Second line')
  })
})
