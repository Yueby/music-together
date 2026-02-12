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

export const storage = {
  getNickname: () => safeGet('nickname') ?? '',
  setNickname: (v: string) => safeSet('nickname', v),

  getVolume: () => parseFloat(safeGet('volume') ?? '0.8'),
  setVolume: (v: number) => safeSet('volume', String(v)),

  // Lyric settings
  getLyricAlignAnchor: () => (safeGet('lyricAlignAnchor') as 'top' | 'center' | 'bottom') ?? 'center',
  setLyricAlignAnchor: (v: string) => safeSet('lyricAlignAnchor', v),

  getLyricAlignPosition: () => parseFloat(safeGet('lyricAlignPosition') ?? '0.4'),
  setLyricAlignPosition: (v: number) => safeSet('lyricAlignPosition', String(v)),

  getLyricEnableSpring: () => safeGet('lyricEnableSpring') !== 'false',
  setLyricEnableSpring: (v: boolean) => safeSet('lyricEnableSpring', String(v)),

  getLyricEnableBlur: () => safeGet('lyricEnableBlur') !== 'false',
  setLyricEnableBlur: (v: boolean) => safeSet('lyricEnableBlur', String(v)),

  getLyricEnableScale: () => safeGet('lyricEnableScale') !== 'false',
  setLyricEnableScale: (v: boolean) => safeSet('lyricEnableScale', String(v)),

  getLyricFontWeight: () => parseInt(safeGet('lyricFontWeight') ?? '600', 10),
  setLyricFontWeight: (v: number) => safeSet('lyricFontWeight', String(v)),

  // Background settings
  getBgFps: () => parseInt(safeGet('bgFps') ?? '30', 10),
  setBgFps: (v: number) => safeSet('bgFps', String(v)),

  getBgFlowSpeed: () => parseFloat(safeGet('bgFlowSpeed') ?? '2'),
  setBgFlowSpeed: (v: number) => safeSet('bgFlowSpeed', String(v)),

  getBgRenderScale: () => parseFloat(safeGet('bgRenderScale') ?? '0.5'),
  setBgRenderScale: (v: number) => safeSet('bgRenderScale', String(v)),
}
