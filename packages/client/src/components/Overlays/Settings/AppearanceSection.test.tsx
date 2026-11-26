// @vitest-environment jsdom
import { Profiler, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSettingsStore } from '@/stores/settingsStore'
import { AppearanceSection } from './AppearanceSection'
import { LyricsSection } from './LyricsSection'

describe('AppearanceSection & LyricsSection selector hygiene', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    useSettingsStore.getState().resetLyricAlignPosition()
    useSettingsStore.getState().resetBgFlowSpeed()
    vi.unstubAllGlobals()
  })

  it('re-renders AppearanceSection only on background setting changes, not lyric changes', () => {
    const onRender = vi.fn()

    act(() => {
      root.render(
        <TooltipProvider>
          <Profiler id="appearance" onRender={onRender}>
            <AppearanceSection />
          </Profiler>
        </TooltipProvider>,
      )
    })
    expect(onRender).toHaveBeenCalled()
    onRender.mockClear()

    act(() => {
      useSettingsStore.getState().setLyricAlignPosition(0.75)
    })
    expect(onRender).not.toHaveBeenCalled()

    act(() => {
      useSettingsStore.getState().setBgFlowSpeed(3.5)
    })
    expect(onRender).toHaveBeenCalled()
  })

  it('re-renders LyricsSection only on lyric setting changes, not background changes', () => {
    const onRender = vi.fn()

    act(() => {
      root.render(
        <TooltipProvider>
          <Profiler id="lyrics" onRender={onRender}>
            <LyricsSection />
          </Profiler>
        </TooltipProvider>,
      )
    })
    expect(onRender).toHaveBeenCalled()
    onRender.mockClear()

    act(() => {
      useSettingsStore.getState().setBgFlowSpeed(4.0)
    })
    expect(onRender).not.toHaveBeenCalled()

    act(() => {
      useSettingsStore.getState().setLyricAlignPosition(0.25)
    })
    expect(onRender).toHaveBeenCalled()
  })
})
