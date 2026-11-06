import { findClosestLyricLine } from '@/lib/lyricMatching'
import { lyricPlayerBridge } from '@/lib/lyricPlayerBridge'
import { usePlayerStore } from '@/stores/playerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { LyricLine } from '@applemusic-like-lyrics/core'
import '@applemusic-like-lyrics/core/style.css'
import { parseLrc } from '@applemusic-like-lyrics/lyric'
import { LyricPlayer, type LyricPlayerRef } from '@applemusic-like-lyrics/react'
import { useEffect, useMemo, useRef, useState } from 'react'

const FULL_SIZE_STYLE = { width: '100%', height: '100%' } as const

function mergeTranslatedLyrics(lines: LyricLine[], translatedLrc: string): LyricLine[] {
  if (!translatedLrc) return lines

  const translations = parseLrc(translatedLrc)
  return lines.map((line) => {
    const translation = findClosestLyricLine(translations, line.startTime)
    if (!translation) return line

    return {
      ...line,
      translatedLyric: translation.words.map((word) => word.word).join(''),
    }
  })
}

export function LyricDisplay() {
  const lyric = usePlayerStore((s) => s.lyric)
  const tlyric = usePlayerStore((s) => s.tlyric)
  const lyricLoading = usePlayerStore((s) => s.lyricLoading)
  const ttmlLines = usePlayerStore((s) => s.ttmlLines)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  const alignAnchor = useSettingsStore((s) => s.lyricAlignAnchor)
  const alignPosition = useSettingsStore((s) => s.lyricAlignPosition)
  const enableSpring = useSettingsStore((s) => s.lyricEnableSpring)
  const enableBlur = useSettingsStore((s) => s.lyricEnableBlur)
  const enableScale = useSettingsStore((s) => s.lyricEnableScale)
  const hidePassedLines = useSettingsStore((s) => s.lyricHidePassedLines)
  const maskObsceneWordsMode = useSettingsStore((s) => s.lyricMaskObsceneWordsMode)
  const maskObsceneWordChar = useSettingsStore((s) => s.lyricMaskObsceneWordChar)
  const wordFadeWidth = useSettingsStore((s) => s.lyricWordFadeWidth)
  const fontWeight = useSettingsStore((s) => s.lyricFontWeight)
  const fontSize = useSettingsStore((s) => s.lyricFontSize)
  const translationFontSize = useSettingsStore((s) => s.lyricTranslationFontSize)
  const romanFontSize = useSettingsStore((s) => s.lyricRomanFontSize)

  // 使用 AMLL 最新 parser 解析 LRC，并合并平台翻译歌词。
  const lrcLines = useMemo(() => mergeTranslatedLyrics(parseLrc(lyric), tlyric), [lyric, tlyric])

  // TTML / YRC / KRC 优先，LRC 回退
  const amllLines = ttmlLines ?? lrcLines
  const hasLyrics = amllLines.length > 0
  const playerRef = useRef<LyricPlayerRef>(null)
  const [player, setPlayer] = useState<LyricPlayerRef['lyricPlayer']>()

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setPlayer(playerRef.current?.lyricPlayer))
    return () => cancelAnimationFrame(frameId)
  }, [hasLyrics])

  useEffect(() => {
    if (!player) return
    return lyricPlayerBridge.attach(player)
  }, [player])

  if (!hasLyrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xl text-white/50">{lyricLoading ? '歌词加载中...' : '暂无歌词'}</p>
      </div>
    )
  }

  return (
    <div
      className="amll-container h-full w-full"
      style={
        {
          fontWeight,
          '--amll-lp-font-size': `clamp(16px, calc(min(5vh, 7vw) * ${fontSize / 100}), 80px)`,
          '--amll-translated-font-size': `${translationFontSize / 100}em`,
          '--amll-roman-font-size': `${romanFontSize / 100}em`,
        } as React.CSSProperties
      }
    >
      <LyricPlayer
        ref={playerRef}
        lyricLines={amllLines}
        currentTime={Math.round(currentTime * 1000)}
        playing={isPlaying}
        alignAnchor={alignAnchor}
        alignPosition={alignPosition}
        enableSpring={enableSpring}
        enableBlur={enableBlur}
        enableScale={enableScale}
        hidePassedLines={hidePassedLines}
        maskObsceneWordsMode={maskObsceneWordsMode}
        maskObsceneWordChar={maskObsceneWordChar}
        wordFadeWidth={wordFadeWidth}
        style={FULL_SIZE_STYLE}
      />
    </div>
  )
}
