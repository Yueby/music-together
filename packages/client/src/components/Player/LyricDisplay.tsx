import { usePlayerStore } from '@/stores/playerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { LyricLine as AMLLLyricLine } from '@applemusic-like-lyrics/core'
import '@applemusic-like-lyrics/core/style.css'
import { LyricPlayer } from '@applemusic-like-lyrics/react'
import { useMemo } from 'react'

const FULL_SIZE_STYLE = { width: '100%', height: '100%' } as const

interface LyricLine {
  time: number
  text: string
  translation?: string
}

function parseLRC(lrc: string): { time: number; text: string }[] {
  const lines: { time: number; text: string }[] = []
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g
  let match

  while ((match = regex.exec(lrc)) !== null) {
    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const ms = parseInt(match[3].padEnd(3, '0'), 10)
    const time = minutes * 60 + seconds + ms / 1000
    const text = match[4].trim()
    if (text) {
      lines.push({ time, text })
    }
  }

  return lines.sort((a, b) => a.time - b.time)
}

function mergeLyrics(original: string, translated: string): LyricLine[] {
  const origLines = parseLRC(original)
  if (origLines.length === 0) return []

  const result: LyricLine[] = origLines.map((l) => ({ ...l }))

  if (!translated) return result

  const transLines = parseLRC(translated)
  if (transLines.length === 0) return result

  const transMap = new Map<number, string>()
  for (const tl of transLines) {
    transMap.set(Math.round(tl.time * 10) / 10, tl.text)
  }

  for (const line of result) {
    const key = Math.round(line.time * 10) / 10
    const exact = transMap.get(key)
    if (exact) {
      line.translation = exact
      continue
    }
    for (let offset = 1; offset <= 5; offset++) {
      const near =
        transMap.get(Math.round((line.time + offset * 0.1) * 10) / 10) ??
        transMap.get(Math.round((line.time - offset * 0.1) * 10) / 10)
      if (near) {
        line.translation = near
        break
      }
    }
  }

  return result
}

/** 将自有 LRC 解析结果转为 AMLL LyricLine 格式 */
function toAMLLLines(lines: LyricLine[]): AMLLLyricLine[] {
  return lines.map((line, i, arr) => {
    const startMs = Math.round(line.time * 1000)
    const endMs = Math.round((arr[i + 1]?.time ?? line.time + 5) * 1000)
    return {
      words: [
        {
          word: line.text,
          startTime: startMs,
          endTime: endMs,
          romanWord: '',
          obscene: false,
        },
      ],
      translatedLyric: line.translation ?? '',
      romanLyric: '',
      startTime: startMs,
      endTime: endMs,
      isBG: false,
      isDuet: false,
    }
  })
}

export function LyricDisplay() {
  const lyric = usePlayerStore((s) => s.lyric)
  const tlyric = usePlayerStore((s) => s.tlyric)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  const alignAnchor = useSettingsStore((s) => s.lyricAlignAnchor)
  const alignPosition = useSettingsStore((s) => s.lyricAlignPosition)
  const enableSpring = useSettingsStore((s) => s.lyricEnableSpring)
  const enableBlur = useSettingsStore((s) => s.lyricEnableBlur)
  const enableScale = useSettingsStore((s) => s.lyricEnableScale)
  const fontWeight = useSettingsStore((s) => s.lyricFontWeight)
  const fontSize = useSettingsStore((s) => s.lyricFontSize)

  const lines = useMemo(() => mergeLyrics(lyric, tlyric), [lyric, tlyric])
  const amllLines = useMemo(() => toAMLLLines(lines), [lines])

  if (!lyric || lines.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xl text-white/50">暂无歌词</p>
      </div>
    )
  }

  return (
    <div
      className="amll-container h-full w-full"
      style={{ fontWeight, fontSize: `${fontSize}%` }}
    >
      <LyricPlayer
        lyricLines={amllLines}
        currentTime={Math.round(currentTime * 1000)}
        playing={isPlaying}
        alignAnchor={alignAnchor}
        alignPosition={alignPosition}
        enableSpring={enableSpring}
        enableBlur={enableBlur}
        enableScale={enableScale}
        style={FULL_SIZE_STYLE}
      />
    </div>
  )
}
