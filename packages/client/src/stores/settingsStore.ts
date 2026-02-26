import { create } from 'zustand'
import { storage, SETTING_DEFAULTS } from '@/lib/storage'

// 重新导出供 UI 层使用
export { SETTING_DEFAULTS }

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 默认值表的 key 类型 */
type SettingKey = keyof typeof SETTING_DEFAULTS

/** 从默认值表的 key 推导出 value 类型 */
type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K]

/** 每个 resettable key 在 store 中生成的四个字段名 */
type ResettableFields<K extends string, V> = {
  [P in K]: V
} & {
  [P in `${K}Default`]: V
} & {
  [P in `set${Capitalize<K>}`]: (v: V) => void
} & {
  [P in `reset${Capitalize<K>}`]: () => void
}

/** 合并所有 resettable key 的字段为完整 SettingsStore 类型 */
type SettingsStore = ResettableFields<'ttmlEnabled', boolean> &
  ResettableFields<'ttmlDbUrl', string> &
  ResettableFields<'lyricAlignAnchor', 'top' | 'center' | 'bottom'> &
  ResettableFields<'lyricAlignPosition', number> &
  ResettableFields<'lyricEnableSpring', boolean> &
  ResettableFields<'lyricEnableBlur', boolean> &
  ResettableFields<'lyricEnableScale', boolean> &
  ResettableFields<'lyricFontWeight', number> &
  ResettableFields<'lyricFontSize', number> &
  ResettableFields<'lyricTranslationFontSize', number> &
  ResettableFields<'lyricRomanFontSize', number> &
  ResettableFields<'bgFps', number> &
  ResettableFields<'bgFlowSpeed', number> &
  ResettableFields<'bgRenderScale', number>

// ---------------------------------------------------------------------------
// Store 实现
// ---------------------------------------------------------------------------

/** 首字母大写 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const useSettingsStore = create<SettingsStore>((set) => {
  /**
   * resettable 工厂：为每个 setting key 生成 4 个 store 字段
   *   key         → 当前值
   *   keyDefault  → 默认值（只读）
   *   setKey      → setter（持久化 + 更新 store）
   *   resetKey    → 恢复默认值
   */
  function resettable<K extends SettingKey>(
    key: K,
    load: () => SettingValue<K>,
    persist: (v: SettingValue<K>) => void,
  ): Record<string, unknown> {
    const defaultValue = SETTING_DEFAULTS[key]
    const initial = load()
    const cap = capitalize(key)

    const setValue = (v: SettingValue<K>) => {
      persist(v)
      set({ [key]: v } as Partial<SettingsStore>)
    }

    return {
      [key]: initial,
      [`${key}Default`]: defaultValue,
      [`set${cap}`]: setValue,
      [`reset${cap}`]: () => setValue(defaultValue),
    }
  }

  return {
    ...resettable('ttmlEnabled', storage.getTtmlEnabled, storage.setTtmlEnabled),
    ...resettable('ttmlDbUrl', storage.getTtmlDbUrl, storage.setTtmlDbUrl),
    ...resettable('lyricAlignAnchor', storage.getLyricAlignAnchor, storage.setLyricAlignAnchor),
    ...resettable('lyricAlignPosition', storage.getLyricAlignPosition, storage.setLyricAlignPosition),
    ...resettable('lyricEnableSpring', storage.getLyricEnableSpring, storage.setLyricEnableSpring),
    ...resettable('lyricEnableBlur', storage.getLyricEnableBlur, storage.setLyricEnableBlur),
    ...resettable('lyricEnableScale', storage.getLyricEnableScale, storage.setLyricEnableScale),
    ...resettable('lyricFontWeight', storage.getLyricFontWeight, storage.setLyricFontWeight),
    ...resettable('lyricFontSize', storage.getLyricFontSize, storage.setLyricFontSize),
    ...resettable('lyricTranslationFontSize', storage.getLyricTranslationFontSize, storage.setLyricTranslationFontSize),
    ...resettable('lyricRomanFontSize', storage.getLyricRomanFontSize, storage.setLyricRomanFontSize),
    ...resettable('bgFps', storage.getBgFps, storage.setBgFps),
    ...resettable('bgFlowSpeed', storage.getBgFlowSpeed, storage.setBgFlowSpeed),
    ...resettable('bgRenderScale', storage.getBgRenderScale, storage.setBgRenderScale),
  } as SettingsStore
})
