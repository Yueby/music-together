import { MUSIC_SOURCES, type MusicSource } from '@music-together/shared'
import storageBackend from '@/lib/storageBackend'

const PREFIX = 'mt-'

function safeGet(key: string): string | null {
  try {
    return storageBackend.getItem(`${PREFIX}${key}`)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    storageBackend.setItem(`${PREFIX}${key}`, value)
  } catch {
    // quota exceeded or blocked
  }
}

function safeRemove(key: string): void {
  try {
    storageBackend.removeItem(`${PREFIX}${key}`)
  } catch {
    // blocked
  }
}

// ---------------------------------------------------------------------------
// JSON helpers (safe parse / stringify through the PREFIX system)
// ---------------------------------------------------------------------------

/**
 * Parse JSON from storage. The value may be stale (older app version) or hand-edited, so
 * callers must pass a `validate` that proves its shape; anything it rejects reads as `null`.
 */
function safeGetJSON<T>(key: string, validate: (value: unknown) => T | null): T | null {
  const raw = safeGet(key)
  if (!raw) return null
  try {
    return validate(JSON.parse(raw))
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Keep only well-formed cookie entries; a non-array value yields `[]`. */
function parseStoredCookies(value: unknown): StoredCookie[] | null {
  if (!Array.isArray(value)) return null
  return value.filter(
    (entry): entry is StoredCookie =>
      isRecord(entry) &&
      typeof entry.platform === 'string' &&
      (MUSIC_SOURCES as readonly string[]).includes(entry.platform) &&
      typeof entry.cookie === 'string',
  )
}

function parseStoredRejoinToken(value: unknown): StoredRejoinToken | null {
  if (!isRecord(value)) return null
  const { roomId, token, expiresAt } = value
  if (typeof roomId !== 'string' || typeof token !== 'string') return null
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null
  return { roomId, token, expiresAt }
}

function readAuthCookies(): StoredCookie[] {
  return safeGetJSON('auth-cookies', parseStoredCookies) ?? []
}

function safeSetJSON(key: string, value: unknown): void {
  safeSet(key, JSON.stringify(value))
}

/** Parse a float from storage, returning the fallback if invalid */
function safeFloat(key: string, fallback: number): number {
  const raw = safeGet(key)
  if (raw === null) return fallback
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Parse an int from storage, returning the fallback if invalid */
function safeInt(key: string, fallback: number): number {
  const raw = safeGet(key)
  if (raw === null) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Validate a string value is one of the allowed options */
function safeEnum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const raw = safeGet(key) as T | null
  if (raw !== null && allowed.includes(raw)) return raw
  return fallback
}

const LYRIC_ANCHORS = ['top', 'center', 'bottom'] as const
const LYRIC_MASK_MODES = ['', 'full-mask', 'partial-mask'] as const
const BG_RENDERERS = ['pixi', 'mesh'] as const

/** 所有持久化设置项的默认值 — 供 store 层的 resettable 工厂使用 */
export const SETTING_DEFAULTS = {
  ttmlEnabled: true,
  lyricAlignAnchor: 'center' as 'top' | 'center' | 'bottom',
  lyricAlignPosition: 0.5,
  lyricEnableSpring: true,
  lyricEnableBlur: false,
  lyricEnableScale: true,
  lyricHidePassedLines: false,
  lyricShowBottomLine: true,
  lyricMaskObsceneWordsMode: '' as '' | 'full-mask' | 'partial-mask',
  lyricMaskObsceneWordChar: '*',
  lyricWordFadeWidth: 0.5,
  lyricFontWeight: 600,
  lyricFontSize: 90,
  lyricTranslationFontSize: 75,
  lyricRomanFontSize: 75,
  bgRenderer: 'pixi' as 'pixi' | 'mesh',
  bgStaticMode: false,
  bgReactToLowFreq: false,
  bgFps: 30,
  bgFlowSpeed: 2,
  bgRenderScale: 0.5,
} satisfies Record<string, unknown>

export const storage = {
  /** Persistent user identity — synced from server identity bootstrap */
  getUserId: (): string => {
    return safeGet('userId') ?? ''
  },
  setUserId: (id: string) => safeSet('userId', id),
  clearUserId: () => safeRemove('userId'),

  getNickname: () => safeGet('nickname') ?? '',
  setNickname: (v: string) => safeSet('nickname', v),

  getVolume: () => {
    const vol = safeFloat('volume', 0.8)
    return Math.max(0, Math.min(1, vol))
  },
  setVolume: (v: number) => safeSet('volume', String(v)),

  // Lyric settings
  getLyricAlignAnchor: () => safeEnum('lyricAlignAnchor', LYRIC_ANCHORS, SETTING_DEFAULTS.lyricAlignAnchor),
  setLyricAlignAnchor: (v: (typeof LYRIC_ANCHORS)[number]) => safeSet('lyricAlignAnchor', v),

  getLyricAlignPosition: () => {
    const pos = safeFloat('lyricAlignPosition', SETTING_DEFAULTS.lyricAlignPosition)
    return Math.max(0, Math.min(1, pos))
  },
  setLyricAlignPosition: (v: number) => safeSet('lyricAlignPosition', String(v)),

  getLyricEnableSpring: () => safeGet('lyricEnableSpring') !== 'false',
  setLyricEnableSpring: (v: boolean) => safeSet('lyricEnableSpring', String(v)),

  getLyricEnableBlur: () => safeGet('lyricEnableBlur') === 'true',
  setLyricEnableBlur: (v: boolean) => safeSet('lyricEnableBlur', String(v)),

  getLyricEnableScale: () => safeGet('lyricEnableScale') !== 'false',
  setLyricEnableScale: (v: boolean) => safeSet('lyricEnableScale', String(v)),

  getLyricHidePassedLines: () => safeGet('lyricHidePassedLines') === 'true',
  setLyricHidePassedLines: (v: boolean) => safeSet('lyricHidePassedLines', String(v)),

  getLyricShowBottomLine: () => safeGet('lyricShowBottomLine') !== 'false',
  setLyricShowBottomLine: (v: boolean) => safeSet('lyricShowBottomLine', String(v)),

  getLyricMaskObsceneWordsMode: () =>
    safeEnum('lyricMaskObsceneWordsMode', LYRIC_MASK_MODES, SETTING_DEFAULTS.lyricMaskObsceneWordsMode),
  setLyricMaskObsceneWordsMode: (v: (typeof LYRIC_MASK_MODES)[number]) => safeSet('lyricMaskObsceneWordsMode', v),

  getLyricMaskObsceneWordChar: () => safeGet('lyricMaskObsceneWordChar')?.slice(0, 1) || SETTING_DEFAULTS.lyricMaskObsceneWordChar,
  setLyricMaskObsceneWordChar: (v: string) => safeSet('lyricMaskObsceneWordChar', v.slice(0, 1) || SETTING_DEFAULTS.lyricMaskObsceneWordChar),

  getLyricWordFadeWidth: () => {
    const width = safeFloat('lyricWordFadeWidth', SETTING_DEFAULTS.lyricWordFadeWidth)
    return Math.max(0.05, Math.min(2, width))
  },
  setLyricWordFadeWidth: (v: number) => safeSet('lyricWordFadeWidth', String(v)),

  getLyricFontWeight: () => {
    const w = safeInt('lyricFontWeight', SETTING_DEFAULTS.lyricFontWeight)
    return Math.max(100, Math.min(900, w))
  },
  setLyricFontWeight: (v: number) => safeSet('lyricFontWeight', String(v)),

  getLyricFontSize: () => {
    const size = safeInt('lyricFontSize', SETTING_DEFAULTS.lyricFontSize)
    return Math.max(10, Math.min(200, size))
  },
  setLyricFontSize: (v: number) => safeSet('lyricFontSize', String(v)),

  getLyricTranslationFontSize: () => {
    const size = safeInt('lyricTranslationFontSize', SETTING_DEFAULTS.lyricTranslationFontSize)
    return Math.max(10, Math.min(200, size))
  },
  setLyricTranslationFontSize: (v: number) => safeSet('lyricTranslationFontSize', String(v)),

  getLyricRomanFontSize: () => {
    const size = safeInt('lyricRomanFontSize', SETTING_DEFAULTS.lyricRomanFontSize)
    return Math.max(10, Math.min(200, size))
  },
  setLyricRomanFontSize: (v: number) => safeSet('lyricRomanFontSize', String(v)),

  // TTML 在线逐词歌词
  getTtmlEnabled: () => safeGet('ttmlEnabled') !== 'false', // 默认开启
  setTtmlEnabled: (v: boolean) => safeSet('ttmlEnabled', String(v)),

  // Background settings
  getBgRenderer: () => safeEnum('bgRenderer', BG_RENDERERS, SETTING_DEFAULTS.bgRenderer),
  setBgRenderer: (v: (typeof BG_RENDERERS)[number]) => safeSet('bgRenderer', v),

  getBgStaticMode: () => safeGet('bgStaticMode') === 'true',
  setBgStaticMode: (v: boolean) => safeSet('bgStaticMode', String(v)),

  getBgReactToLowFreq: () => safeGet('bgReactToLowFreq') === 'true',
  setBgReactToLowFreq: (v: boolean) => safeSet('bgReactToLowFreq', String(v)),

  getBgFps: () => {
    const fps = safeInt('bgFps', SETTING_DEFAULTS.bgFps)
    return [15, 30, 60].includes(fps) ? fps : SETTING_DEFAULTS.bgFps
  },
  setBgFps: (v: number) => safeSet('bgFps', String(v)),

  getBgFlowSpeed: () => {
    const speed = safeFloat('bgFlowSpeed', SETTING_DEFAULTS.bgFlowSpeed)
    return Math.max(0.5, Math.min(5, speed))
  },
  setBgFlowSpeed: (v: number) => safeSet('bgFlowSpeed', String(v)),

  getBgRenderScale: () => {
    const scale = safeFloat('bgRenderScale', SETTING_DEFAULTS.bgRenderScale)
    return [0.25, 0.5, 0.75, 1].includes(scale) ? scale : SETTING_DEFAULTS.bgRenderScale
  },
  setBgRenderScale: (v: number) => safeSet('bgRenderScale', String(v)),

  // Auth cookie persistence
  getAuthCookies: (): StoredCookie[] => readAuthCookies(),
  setAuthCookies: (cookies: StoredCookie[]) => safeSetJSON('auth-cookies', cookies),

  upsertAuthCookie: (platform: MusicSource, cookie: string) => {
    const list = readAuthCookies().filter((c) => c.platform !== platform)
    list.push({ platform, cookie })
    safeSetJSON('auth-cookies', list)
  },

  removeAuthCookie: (platform: MusicSource) => {
    const list = readAuthCookies().filter((c) => c.platform !== platform)
    safeSetJSON('auth-cookies', list)
  },

  hasAuthCookie: (platform: MusicSource): boolean => {
    return readAuthCookies().some((c) => c.platform === platform)
  },

  getRejoinToken: (roomId: string): string | null => {
    const data = safeGetJSON('rejoin-token', parseStoredRejoinToken)
    if (!data) return null
    if (data.roomId !== roomId) return null
    if (data.expiresAt <= Date.now()) return null
    return data.token
  },
  setRejoinToken: (roomId: string, token: string, expiresAt: number) =>
    safeSetJSON('rejoin-token', { roomId, token, expiresAt } satisfies StoredRejoinToken),
  clearRejoinToken: (roomId?: string) => {
    const data = safeGetJSON('rejoin-token', parseStoredRejoinToken)
    if (!data) return
    if (roomId && data.roomId !== roomId) return
    safeRemove('rejoin-token')
  },
}

/** Shape stored in localStorage for auth cookies */
export interface StoredCookie {
  platform: MusicSource
  cookie: string
}

interface StoredRejoinToken {
  roomId: string
  token: string
  expiresAt: number
}
