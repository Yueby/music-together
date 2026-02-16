import type { MusicSource } from '@music-together/shared'
import { nanoid } from 'nanoid'

const PREFIX = 'mt-'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(`${PREFIX}${key}`)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(`${PREFIX}${key}`, value)
  } catch {
    // quota exceeded or blocked
  }
}

// ---------------------------------------------------------------------------
// JSON helpers (safe parse / stringify through the PREFIX system)
// ---------------------------------------------------------------------------

function safeGetJSON<T>(key: string): T | null {
  const raw = safeGet(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
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
const LYRIC_FONT_SIZES = [75, 90, 100, 110, 125, 150] as const
const LYRIC_TRANS_FONT_SIZES = [50, 65, 75, 90, 100] as const

export const storage = {
  /** Persistent user identity — generated once and stored in localStorage */
  getUserId: (): string => {
    let id = safeGet('userId')
    if (!id) {
      id = nanoid()
      safeSet('userId', id)
    }
    return id
  },

  getNickname: () => safeGet('nickname') ?? '',
  setNickname: (v: string) => safeSet('nickname', v),

  getVolume: () => {
    const vol = safeFloat('volume', 0.8)
    return Math.max(0, Math.min(1, vol))
  },
  setVolume: (v: number) => safeSet('volume', String(v)),

  // Lyric settings
  getLyricAlignAnchor: () => safeEnum('lyricAlignAnchor', LYRIC_ANCHORS, 'center'),
  setLyricAlignAnchor: (v: string) => safeSet('lyricAlignAnchor', v),

  getLyricAlignPosition: () => {
    const pos = safeFloat('lyricAlignPosition', 0.4)
    return Math.max(0, Math.min(1, pos))
  },
  setLyricAlignPosition: (v: number) => safeSet('lyricAlignPosition', String(v)),

  getLyricEnableSpring: () => safeGet('lyricEnableSpring') !== 'false',
  setLyricEnableSpring: (v: boolean) => safeSet('lyricEnableSpring', String(v)),

  getLyricEnableBlur: () => safeGet('lyricEnableBlur') === 'true',
  setLyricEnableBlur: (v: boolean) => safeSet('lyricEnableBlur', String(v)),

  getLyricEnableScale: () => safeGet('lyricEnableScale') !== 'false',
  setLyricEnableScale: (v: boolean) => safeSet('lyricEnableScale', String(v)),

  getLyricFontWeight: () => {
    const w = safeInt('lyricFontWeight', 600)
    return [400, 500, 600, 700].includes(w) ? w : 600
  },
  setLyricFontWeight: (v: number) => safeSet('lyricFontWeight', String(v)),

  getLyricFontSize: () => {
    const size = safeInt('lyricFontSize', 100)
    return (LYRIC_FONT_SIZES as readonly number[]).includes(size) ? size : 100
  },
  setLyricFontSize: (v: number) => safeSet('lyricFontSize', String(v)),

  getLyricTranslationFontSize: () => {
    const size = safeInt('lyricTranslationFontSize', 65)
    return (LYRIC_TRANS_FONT_SIZES as readonly number[]).includes(size) ? size : 65
  },
  setLyricTranslationFontSize: (v: number) => safeSet('lyricTranslationFontSize', String(v)),

  // Background settings
  getBgFps: () => {
    const fps = safeInt('bgFps', 30)
    return [15, 30, 60].includes(fps) ? fps : 30
  },
  setBgFps: (v: number) => safeSet('bgFps', String(v)),

  getBgFlowSpeed: () => {
    const speed = safeFloat('bgFlowSpeed', 2)
    return Math.max(0.5, Math.min(5, speed))
  },
  setBgFlowSpeed: (v: number) => safeSet('bgFlowSpeed', String(v)),

  getBgRenderScale: () => {
    const scale = safeFloat('bgRenderScale', 0.5)
    return [0.25, 0.5, 0.75, 1].includes(scale) ? scale : 0.5
  },
  setBgRenderScale: (v: number) => safeSet('bgRenderScale', String(v)),

  // Auth cookie persistence
  getAuthCookies: (): StoredCookie[] => safeGetJSON<StoredCookie[]>('auth-cookies') ?? [],
  setAuthCookies: (cookies: StoredCookie[]) => safeSetJSON('auth-cookies', cookies),

  upsertAuthCookie: (platform: MusicSource, cookie: string) => {
    const list = (safeGetJSON<StoredCookie[]>('auth-cookies') ?? []).filter(
      (c) => c.platform !== platform,
    )
    list.push({ platform, cookie })
    safeSetJSON('auth-cookies', list)
  },

  removeAuthCookie: (platform: MusicSource) => {
    const list = (safeGetJSON<StoredCookie[]>('auth-cookies') ?? []).filter(
      (c) => c.platform !== platform,
    )
    safeSetJSON('auth-cookies', list)
  },

  hasAuthCookie: (platform: MusicSource): boolean => {
    const list = safeGetJSON<StoredCookie[]>('auth-cookies') ?? []
    return list.some((c) => c.platform === platform)
  },
}

/** Shape stored in localStorage for auth cookies */
export interface StoredCookie {
  platform: MusicSource
  cookie: string
}
