// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { PROTOCOL_VERSION } from '@music-together/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportServerVersion, useVersionStore } from '@/stores/versionStore'
import { useVersionCheck } from './useVersionCheck'

const { hostRuntime, metadataFetch } = vi.hoisted(() => ({
  hostRuntime: { versionCheck: true },
  metadataFetch: vi.fn(),
}))
vi.mock('@/lib/hostRuntime', () => ({ hostRuntime }))
vi.mock('@/lib/metadataFetch', () => ({ metadataFetch }))

beforeEach(() => {
  hostRuntime.versionCheck = true
  metadataFetch.mockReset()
  useVersionStore.setState({ hasUpdate: false, breakingUpdate: false })
  vi.stubGlobal('__APP_VERSION__', '1.0.1')
  vi.stubGlobal('__BUILD_ID__', 'first-build')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useVersionCheck', () => {
  it.each([
    { version: '1.0.1', buildId: 'deploy-2', protocol: PROTOCOL_VERSION, breakingUpdate: false },
    { version: '1.0.1', buildId: 'first-build', protocol: PROTOCOL_VERSION + 1, breakingUpdate: true },
    { version: '1.0.2', buildId: 'first-build', protocol: PROTOCOL_VERSION, breakingUpdate: false },
  ])('reports an update from /api/version for %j', async ({ breakingUpdate, ...release }) => {
    metadataFetch.mockResolvedValue({ ok: true, json: async () => release })
    const first = renderHook(useVersionCheck)
    await waitFor(() => expect(first.result.current).toEqual({ hasUpdate: true, breakingUpdate }))
    expect(metadataFetch).toHaveBeenCalledWith(expect.stringContaining('/api/version'), expect.anything())
    const second = renderHook(useVersionCheck)
    expect(second.result.current).toEqual(first.result.current)
  })

  it.each([
    ['dev', 'dev'],
    ['dev', 'server-build'],
    ['client-build', 'dev'],
  ])('ignores the build comparison when either side is dev (%s, %s)', (clientBuild, serverBuild) => {
    vi.stubGlobal('__BUILD_ID__', clientBuild)
    reportServerVersion({ version: '1.0.1', buildId: serverBuild, protocol: PROTOCOL_VERSION })
    expect(useVersionStore.getState()).toEqual({ hasUpdate: false, breakingUpdate: false })
  })

  it('suppresses fetching and update status in the mini-app host', () => {
    hostRuntime.versionCheck = false
    reportServerVersion({ version: '2.0.0', buildId: 'deploy-2', protocol: PROTOCOL_VERSION + 1 })
    expect(useVersionStore.getState().hasUpdate).toBe(false)
    useVersionStore.setState({ hasUpdate: true, breakingUpdate: true })
    const hook = renderHook(useVersionCheck)
    expect(hook.result.current).toEqual({ hasUpdate: false, breakingUpdate: false })
    expect(metadataFetch).not.toHaveBeenCalled()
  })
})
