import { SERVER_URL } from '@/lib/config'
import { usePlayerStore } from '@/stores/playerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { parseTTML, parseYrc } from '@applemusic-like-lyrics/lyric'
import type { LyricLine as AMLLLyricLine } from '@applemusic-like-lyrics/core'
import type { Track } from '@music-together/shared'
import { useCallback, useEffect, useRef } from 'react'

/** 支持 TTML 的平台 → TTML DB 文件夹映射 */
const TTML_FOLDER_MAP: Record<string, string> = {
  netease: 'ncm-lyrics',
  tencent: 'qq-lyrics',
}

/** TTML 请求超时（ms） */
const TTML_TIMEOUT_MS = 8_000

/**
 * 将 @applemusic-like-lyrics/lyric 的 LyricLine 转为 @applemusic-like-lyrics/core 的 LyricLine
 * 两者接口略有差异（core 的 LyricWord 多 obscene 字段）
 */
function toCoreLyricLines(lyricLines: ReturnType<typeof parseTTML>['lines']): AMLLLyricLine[] {
  return lyricLines.map((line) => ({
    words: line.words.map((w) => ({
      word: w.word,
      startTime: w.startTime,
      endTime: w.endTime,
      romanWord: w.romanWord ?? '',
      obscene: false,
    })),
    translatedLyric: line.translatedLyric ?? '',
    romanLyric: line.romanLyric ?? '',
    startTime: line.startTime,
    endTime: line.endTime,
    isBG: line.isBG ?? false,
    isDuet: line.isDuet ?? false,
  }))
}

/**
 * parseYrc 返回的是裸 LyricLine[]（无 .lines 包装）
 * 直接转为 core 格式
 */
function yrcToCoreLyricLines(lines: ReturnType<typeof parseYrc>): AMLLLyricLine[] {
  return lines.map((line) => ({
    words: line.words.map((w) => ({
      word: w.word,
      startTime: w.startTime,
      endTime: w.endTime,
      romanWord: w.romanWord ?? '',
      obscene: false,
    })),
    translatedLyric: line.translatedLyric ?? '',
    romanLyric: line.romanLyric ?? '',
    startTime: line.startTime,
    endTime: line.endTime,
    isBG: line.isBG ?? false,
    isDuet: line.isDuet ?? false,
  }))
}

export function useLyric() {
  const setLyric = usePlayerStore((s) => s.setLyric)
  const setTtmlLines = usePlayerStore((s) => s.setTtmlLines)
  const setLyricLoading = usePlayerStore((s) => s.setLyricLoading)
  const abortRef = useRef<AbortController | null>(null)

  // Abort any in-flight lyric request on unmount
  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  const fetchLyric = useCallback(
    async (track: Track) => {
      // Cancel any in-flight lyric request (e.g. rapid track switching)
      abortRef.current?.abort()
      abortRef.current = null

      // 重置歌词状态（立即清空，避免显示上一首歌的歌词）
      setTtmlLines(null)
      setLyric('', '')
      setLyricLoading(true)

      const controller = new AbortController()
      abortRef.current = controller

      let wordByWordSuccess = false

      // ========================================
      // 1. 优先：TTML 在线逐词歌词（如果开启）
      // ========================================
      const { ttmlEnabled, ttmlDbUrl } = useSettingsStore.getState()
      const folder = TTML_FOLDER_MAP[track.source]
      if (ttmlEnabled && folder) {
        try {
          // URL 模板：%s 替换为歌曲 ID，ncm-lyrics 适配平台
          const ttmlUrl = ttmlDbUrl.replace('ncm-lyrics', folder).replace('%s', track.sourceId)
          // 绑定主 controller：切歌/卸载时取消 TTML，避免过时响应写回 store；同时 8s 超时
          const timeoutSignal =
            typeof AbortSignal?.timeout === 'function'
              ? AbortSignal.timeout(TTML_TIMEOUT_MS)
              : null
          const ttmlSignal =
            timeoutSignal && typeof AbortSignal?.any === 'function'
              ? AbortSignal.any([controller.signal, timeoutSignal])
              : controller.signal

          const ttmlRes = await fetch(ttmlUrl, { signal: ttmlSignal })

          if (ttmlRes.ok) {
            const ttmlText = await ttmlRes.text()
            // 确保返回的是 XML/TTML 而非错误页面
            if (ttmlText.includes('<tt') || ttmlText.includes('<?xml')) {
              const parsed = parseTTML(ttmlText)
              if (parsed.lines.length > 0) {
                setTtmlLines(toCoreLyricLines(parsed.lines))
                wordByWordSuccess = true
              }
            }
          }
        } catch {
          // TTML 获取失败（超时/网络错误），静默回退
          if (controller.signal.aborted) return
        }
      }

      // ========================================
      // 2. 获取服务端歌词（包含 LRC + 可能的 YRC/KRC）
      // ========================================
      let lyricData: {
        lyric: string
        tlyric: string
        yrc: string
        wordByWord?: AMLLLyricLine[]
      } | null = null

      if (track.lyricId) {
        try {
          const res = await fetch(
            `${SERVER_URL}/api/music/lyric?source=${track.source}&lyricId=${encodeURIComponent(track.lyricId)}`,
            { signal: controller.signal },
          )
          if (res.ok) {
            lyricData = await res.json()
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
        }
      }

      // ========================================
      // 3. 其次：平台原生逐词歌词（KRC 酷狗 / YRC 网易云）
      // ========================================
      if (!wordByWordSuccess && lyricData?.wordByWord?.length) {
        setTtmlLines(lyricData.wordByWord)
        wordByWordSuccess = true
      } else if (!wordByWordSuccess && lyricData?.yrc) {
        try {
          const parsed = parseYrc(lyricData.yrc)
          if (parsed.length > 0) {
            setTtmlLines(yrcToCoreLyricLines(parsed))
            wordByWordSuccess = true
          }
        } catch {
          // YRC 解析失败，走 LRC 兜底
        }
      }

      // ========================================
      // 4. 兜底：设置 LRC 歌词
      // ========================================
      if (lyricData) {
        setLyric(lyricData.lyric || '', lyricData.tlyric || '')
      } else if (!wordByWordSuccess) {
        setLyric('', '')
      }

      setLyricLoading(false)
    },
    [setLyric, setTtmlLines, setLyricLoading],
  )

  return { fetchLyric }
}
