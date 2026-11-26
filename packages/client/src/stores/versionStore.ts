import { PROTOCOL_VERSION } from '@music-together/shared'
import { hostRuntime } from '@/lib/hostRuntime'
import { create } from 'zustand'

const initialVersionStatus = { hasUpdate: false, breakingUpdate: false }
export const useVersionStore = create(() => initialVersionStatus)

export function reportServerVersion({ version, buildId, protocol }: {
  version?: string
  buildId?: string
  protocol?: number
}) {
  if (!hostRuntime.versionCheck) return
  const breakingUpdate = typeof protocol === 'number' && protocol !== PROTOCOL_VERSION
  const clientBuild = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'
  const differentBuild = Boolean(buildId && buildId !== 'dev' && clientBuild !== 'dev' && buildId !== clientBuild)
  const differentVersion = Boolean(version && version !== __APP_VERSION__)
  if (breakingUpdate || differentBuild || differentVersion) {
    useVersionStore.setState((state) => ({ hasUpdate: true, breakingUpdate: state.breakingUpdate || breakingUpdate }))
  }
}
