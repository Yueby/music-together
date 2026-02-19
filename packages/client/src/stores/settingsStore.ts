import { create } from 'zustand'
import { storage } from '@/lib/storage'

interface SettingsStore {
  // AMLL Lyrics
  ttmlEnabled: boolean
  ttmlDbUrl: string
  lyricAlignAnchor: 'top' | 'center' | 'bottom'
  lyricAlignPosition: number
  lyricEnableSpring: boolean
  lyricEnableBlur: boolean
  lyricEnableScale: boolean
  lyricFontWeight: number
  lyricFontSize: number
  lyricTranslationFontSize: number

  // Background
  bgFps: number
  bgFlowSpeed: number
  bgRenderScale: number

  // Setters
  setTtmlEnabled: (v: boolean) => void
  setTtmlDbUrl: (v: string) => void
  setLyricAlignAnchor: (v: 'top' | 'center' | 'bottom') => void
  setLyricAlignPosition: (v: number) => void
  setLyricEnableSpring: (v: boolean) => void
  setLyricEnableBlur: (v: boolean) => void
  setLyricEnableScale: (v: boolean) => void
  setLyricFontWeight: (v: number) => void
  setLyricFontSize: (v: number) => void
  setLyricTranslationFontSize: (v: number) => void
  setBgFps: (v: number) => void
  setBgFlowSpeed: (v: number) => void
  setBgRenderScale: (v: number) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  // Defaults from localStorage
  ttmlEnabled: storage.getTtmlEnabled(),
  ttmlDbUrl: storage.getTtmlDbUrl(),
  lyricAlignAnchor: storage.getLyricAlignAnchor(),
  lyricAlignPosition: storage.getLyricAlignPosition(),
  lyricEnableSpring: storage.getLyricEnableSpring(),
  lyricEnableBlur: storage.getLyricEnableBlur(),
  lyricEnableScale: storage.getLyricEnableScale(),
  lyricFontWeight: storage.getLyricFontWeight(),
  lyricFontSize: storage.getLyricFontSize(),
  lyricTranslationFontSize: storage.getLyricTranslationFontSize(),

  bgFps: storage.getBgFps(),
  bgFlowSpeed: storage.getBgFlowSpeed(),
  bgRenderScale: storage.getBgRenderScale(),

  // Setters (persist + update state)
  setTtmlEnabled: (v) => {
    storage.setTtmlEnabled(v)
    set({ ttmlEnabled: v })
  },
  setTtmlDbUrl: (v) => {
    storage.setTtmlDbUrl(v)
    set({ ttmlDbUrl: v })
  },
  setLyricAlignAnchor: (v) => {
    storage.setLyricAlignAnchor(v)
    set({ lyricAlignAnchor: v })
  },
  setLyricAlignPosition: (v) => {
    storage.setLyricAlignPosition(v)
    set({ lyricAlignPosition: v })
  },
  setLyricEnableSpring: (v) => {
    storage.setLyricEnableSpring(v)
    set({ lyricEnableSpring: v })
  },
  setLyricEnableBlur: (v) => {
    storage.setLyricEnableBlur(v)
    set({ lyricEnableBlur: v })
  },
  setLyricEnableScale: (v) => {
    storage.setLyricEnableScale(v)
    set({ lyricEnableScale: v })
  },
  setLyricFontWeight: (v) => {
    storage.setLyricFontWeight(v)
    set({ lyricFontWeight: v })
  },
  setLyricFontSize: (v) => {
    storage.setLyricFontSize(v)
    set({ lyricFontSize: v })
  },
  setLyricTranslationFontSize: (v) => {
    storage.setLyricTranslationFontSize(v)
    set({ lyricTranslationFontSize: v })
  },
  setBgFps: (v) => {
    storage.setBgFps(v)
    set({ bgFps: v })
  },
  setBgFlowSpeed: (v) => {
    storage.setBgFlowSpeed(v)
    set({ bgFlowSpeed: v })
  },
  setBgRenderScale: (v) => {
    storage.setBgRenderScale(v)
    set({ bgRenderScale: v })
  },
}))
