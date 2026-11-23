import { SERVER_URL } from '@/lib/config'
import { metadataFetch } from '@/lib/metadataFetch'
import { findClosestLyricLine } from '@/lib/lyricMatching'
import { usePlayerStore } from '@/stores/playerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { LyricLine } from '@applemusic-like-lyrics/core'
import { parseLrc, parseYrc } from '@applemusic-like-lyrics/lyric'
import { TTML_SOURCES, type Track } from '@music-together/shared'
import { useCallback, useEffect, useRef } from 'react'

const isTtmlSource = (source: string): source is (typeof TTML_SOURCES)[number] =>
  (TTML_SOURCES as readonly string[]).includes(source)

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

      // 服务端歌词（LRC + 可能的 YRC/KRC）与 TTML 同时请求：TTML 库慢或不可用时不拖慢基础歌词
      type ServerLyric = {
        lyric: string
        tlyric: string
        romalrc: string
        yrc: string
        wordByWord?: LyricLine[]
      }
      const lyricRequest: Promise<ServerLyric | null> = track.lyricId
        ? metadataFetch(
            `${SERVER_URL}/api/music/lyric?source=${track.source}&lyricId=${encodeURIComponent(track.lyricId)}`,
            { signal: controller.signal, credentials: 'include' },
          ).then(
            (res) => (res.ok ? (res.json() as Promise<ServerLyric>) : null),
            () => null,
          )
        : Promise.resolve(null)

      // ========================================
      // TTML 在线逐词歌词（如果开启）：服务端取库文件并解析，两端都只收到歌词行
      // （浏览器直连第三方库会被 CORS 拦截，微应用既无权访问外部地址，其 Trusted Types 也不允许 DOMParser）。
      // 与服务端歌词并行：谁先到谁先显示；TTML 成功后覆盖基础歌词。
      // ========================================
      let ttmlApplied = false
      const fetchTtml = async () => {
        const { ttmlEnabled } = useSettingsStore.getState()
        if (!ttmlEnabled || !isTtmlSource(track.source)) return
        try {
          const ttmlUrl = `${SERVER_URL}/api/music/ttml?source=${track.source}&id=${encodeURIComponent(track.sourceId)}`
          // 绑定主 controller：切歌/卸载时取消 TTML，避免过时响应写回 store；同时 8s 超时
          const timeoutSignal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(TTML_TIMEOUT_MS) : null
          const SignalFactory = AbortSignal as typeof AbortSignal & {
            any?: (signals: AbortSignal[]) => AbortSignal
          }
          const ttmlSignal =
            timeoutSignal && typeof SignalFactory.any === 'function'
              ? SignalFactory.any([controller.signal, timeoutSignal])
              : controller.signal

          const ttmlRes = await metadataFetch(ttmlUrl, { signal: ttmlSignal, credentials: 'include' })
          if (!ttmlRes.ok) return
          // `lines: null` 表示库里没有这首歌
          const body = (await ttmlRes.json()) as { lines?: unknown }
          if (controller.signal.aborted || !Array.isArray(body.lines) || body.lines.length === 0) return
          ttmlApplied = true
          setTtmlLines(body.lines as LyricLine[])
          setLyricLoading(false)
        } catch {
          // TTML 获取失败（超时/网络错误），静默回退
        }
      }

      // ========================================
      // 平台原生逐词歌词（KRC 酷狗 / YRC 网易云）与 LRC 兜底。
      // YRC/KRC 格式本身不携带翻译，需要将服务端返回的 tlyric（LRC 格式）按时间戳合并到 translatedLyric 字段
      // ========================================
      const applyServerLyric = async () => {
        const lyricData = await lyricRequest
        if (controller.signal.aborted) return // 已切歌/卸载，丢弃结果

        let wordByWordSuccess = ttmlApplied
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

        if (lyricData) {
          setLyric(lyricData.lyric || '', lyricData.tlyric || '')
        } else if (!wordByWordSuccess) {
          setLyric('', '')
        }
        // TTML 仍在途中时，基础歌词先行展示
        setLyricLoading(false)
      }

      await Promise.all([fetchTtml(), applyServerLyric()])
      if (controller.signal.aborted) return
      setLyricLoading(false)
    },
    [setLyric, setTtmlLines, setLyricLoading],
  )

  return { fetchLyric }
}
