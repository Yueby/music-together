import { SERVER_URL } from '@/lib/config'
import { findClosestLyricLine } from '@/lib/lyricMatching'
import { usePlayerStore } from '@/stores/playerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { LyricLine } from '@applemusic-like-lyrics/core'
import { parseLrc, parseTTML, parseYrc } from '@applemusic-like-lyrics/lyric'
import type { Track } from '@music-together/shared'
import { useCallback, useEffect, useRef } from 'react'

/** 支持 TTML 的平台 → TTML DB 文件夹映射 */
const TTML_FOLDER_MAP: Record<string, string> = {
  netease: 'ncm-lyrics',
  tencent: 'qq-lyrics',
}

/** TTML 请求超时（ms） */
const TTML_TIMEOUT_MS = 8_000

function mergeAuxiliaryLyrics(
  lines: LyricLine[],
  lrc: string,
  field: 'translatedLyric' | 'romanLyric',
): LyricLine[] {
  if (!lrc) return lines

  const auxiliaryLines = parseLrc(lrc)
  return lines.map((line) => {
    if (line[field]) return line

    const auxiliary = findClosestLyricLine(auxiliaryLines, line.startTime)
    if (!auxiliary) return line

    return {
      ...line,
      [field]: auxiliary.words.map((word) => word.word).join(''),
    }
  })
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
          const timeoutSignal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(TTML_TIMEOUT_MS) : null
          const SignalFactory = AbortSignal as typeof AbortSignal & {
            any?: (signals: AbortSignal[]) => AbortSignal
          }
          const ttmlSignal =
            timeoutSignal && typeof SignalFactory.any === 'function'
              ? SignalFactory.any([controller.signal, timeoutSignal])
              : controller.signal

          const ttmlRes = await fetch(ttmlUrl, { signal: ttmlSignal })

          if (ttmlRes.ok) {
            const ttmlText = await ttmlRes.text()
            // 确保返回的是 XML/TTML 而非错误页面
            if (ttmlText.includes('<tt') || ttmlText.includes('<?xml')) {
              const parsed = parseTTML(ttmlText)
              if (parsed.lines.length > 0) {
                setTtmlLines(parsed.lines)
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
        romalrc: string
        yrc: string
        wordByWord?: LyricLine[]
      } | null = null

      if (track.lyricId) {
        try {
          const res = await fetch(
            `${SERVER_URL}/api/music/lyric?source=${track.source}&lyricId=${encodeURIComponent(track.lyricId)}`,
            { signal: controller.signal, credentials: 'include' },
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
      //    YRC/KRC 格式本身不携带翻译，需要将服务端返回的
      //    tlyric（LRC 格式）按时间戳合并到 translatedLyric 字段
      // ========================================
      if (!wordByWordSuccess && lyricData?.wordByWord?.length) {
        // KRC：服务端已经返回 AMLL 最新 LyricLine 结构。
        const translatedLines = mergeAuxiliaryLyrics(lyricData.wordByWord, lyricData.tlyric, 'translatedLyric')
        const completeLines = mergeAuxiliaryLyrics(translatedLines, lyricData.romalrc, 'romanLyric')
        setTtmlLines(completeLines)
        wordByWordSuccess = true
      } else if (!wordByWordSuccess && lyricData?.yrc) {
        try {
          let lines = parseYrc(lyricData.yrc)
          if (lines.length > 0) {
            lines = mergeAuxiliaryLyrics(lines, lyricData.tlyric, 'translatedLyric')
            lines = mergeAuxiliaryLyrics(lines, lyricData.romalrc, 'romanLyric')
            setTtmlLines(lines)
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
