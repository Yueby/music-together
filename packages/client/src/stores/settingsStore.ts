import { create } from 'zustand'
import { storage } from '@/lib/storage'

interface SettingsStore {
  // AMLL Lyrics
  lyricAlignAnchor: 'top' | 'center' | 'bottom'
  lyricAlignPosition: number
  lyricEnableSpring: boolean
  lyricEnableBlur: boolean
  lyricEnableScale: boolean
  lyricFontWeight: number

  // Background
  bgFps: number
  bgFlowSpeed: number
  bgRenderScale: number

  // Setters
  setLyricAlignAnchor: (v: 'top' | 'center' | 'bottom') => void
  setLyricAlignPosition: (v: number) => void
  setLyricEnableSpring: (v: boolean) => void
  setLyricEnableBlur: (v: boolean) => void
  setLyricEnableScale: (v: boolean) => void
  setLyricFontWeight: (v: number) => void
  setBgFps: (v: number) => void
  setBgFlowSpeed: (v: number) => void
  setBgRenderScale: (v: number) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  // Defaults from localStorage
  lyricAlignAnchor: storage.getLyricAlignAnchor(),
  lyricAlignPosition: storage.getLyricAlignPosition(),
  lyricEnableSpring: storage.getLyricEnableSpring(),
  lyricEnableBlur: storage.getLyricEnableBlur(),
  lyricEnableScale: storage.getLyricEnableScale(),
  lyricFontWeight: storage.getLyricFontWeight(),

  bgFps: storage.getBgFps(),
  bgFlowSpeed: storage.getBgFlowSpeed(),
  bgRenderScale: storage.getBgRenderScale(),

  // Setters (persist + update state)
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
