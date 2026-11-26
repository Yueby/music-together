import { SERVER_URL } from '@/lib/config'
import { hostRuntime } from '@/lib/hostRuntime'
import { metadataFetch } from '@/lib/metadataFetch'
import { reportServerVersion, useVersionStore } from '@/stores/versionStore'
import { useEffect } from 'react'

/**
 * Check on mount and share the result with the socket handshake.
 */
export function useVersionCheck() {
  const hasUpdate = useVersionStore((s) => s.hasUpdate)
  const breakingUpdate = useVersionStore((s) => s.breakingUpdate)

  useEffect(() => {
    if (!hostRuntime.versionCheck) return
    const controller = new AbortController()

    metadataFetch(`${SERVER_URL}/api/version`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Parameters<typeof reportServerVersion>[0] | null) => {
        if (data && !controller.signal.aborted) reportServerVersion(data)
      })
      .catch(() => {
        // Silently ignore — network errors, server down, etc.
      })

    return () => controller.abort()
  }, [])

  return {
    hasUpdate: hostRuntime.versionCheck && hasUpdate,
    breakingUpdate: hostRuntime.versionCheck && breakingUpdate,
  }
}
