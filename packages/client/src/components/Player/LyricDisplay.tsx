import { useMemo, useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePlayerStore } from '@/stores/playerStore'
import { cn } from '@/lib/utils'

interface LyricLine {
  time: number
  text: string
  translation?: string
}

/**
 * Parse a single LRC string into time-text pairs.
 */
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

/**
 * Merge original lyrics with translation lyrics by matching timestamps.
 * Translation lines are mapped to the closest original line within 0.5s tolerance.
 */
function mergeLyrics(original: string, translated: string): LyricLine[] {
  const origLines = parseLRC(original)
  if (origLines.length === 0) return []

  const result: LyricLine[] = origLines.map((l) => ({ ...l }))

  if (!translated) return result

  const transLines = parseLRC(translated)
  if (transLines.length === 0) return result

  // Build a map of time -> translation text for O(1) lookup
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
    // Try nearby times within ±0.5s
    for (let offset = 1; offset <= 5; offset++) {
      const near = transMap.get(Math.round((line.time + offset * 0.1) * 10) / 10)
        ?? transMap.get(Math.round((line.time - offset * 0.1) * 10) / 10)
      if (near) {
        line.translation = near
        break
      }
    }
  }

  return result
}

export function LyricDisplay() {
  const lyric = usePlayerStore((s) => s.lyric)
  const tlyric = usePlayerStore((s) => s.tlyric)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const lyricsRef = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => mergeLyrics(lyric, tlyric), [lyric, tlyric])

  const currentIndex = useMemo(() => {
    if (lines.length === 0) return -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if (currentTime >= lines[i].time) return i
    }
    return -1
  }, [lines, currentTime])

  // Auto-scroll to current line
  useEffect(() => {
    if (currentIndex < 0 || !lyricsRef.current) return
    const activeEl = lyricsRef.current.querySelector('[data-active="true"]')
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentIndex])

  if (!lyric || lines.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-lg text-muted-foreground/50">暂无歌词</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div ref={lyricsRef} className="flex flex-col gap-5 px-8 py-16">
        {lines.map((line, i) => {
          const isActive = i === currentIndex
          return (
            <div
              key={i}
              data-active={isActive}
              className={cn(
                'transition-all duration-300',
                isActive ? 'scale-[1.02] origin-left' : '',
              )}
            >
              {/* Original lyric */}
              <p
                className={cn(
                  'leading-relaxed transition-colors duration-300',
                  isActive
                    ? 'text-xl font-bold text-foreground lg:text-2xl xl:text-3xl'
                    : 'text-lg font-medium text-muted-foreground/40 lg:text-xl xl:text-2xl',
                )}
              >
                {line.text}
              </p>
              {/* Translation */}
              {line.translation && (
                <p
                  className={cn(
                    'mt-1 leading-relaxed transition-colors duration-300',
                    isActive
                      ? 'text-xs text-foreground/60 lg:text-sm'
                      : 'text-xs text-muted-foreground/25 lg:text-sm',
                  )}
                >
                  {line.translation}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
