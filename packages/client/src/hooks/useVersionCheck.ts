import { SERVER_URL } from '@/lib/config'
import { useEffect, useState } from 'react'

/**
 * Check once on mount whether the server is running a newer version
 * than the client was built with. Returns `true` when an update is available.
 */
export function useVersionCheck() {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${SERVER_URL}/api/version`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { version: string } | null) => {
        if (data?.version && data.version !== __APP_VERSION__) {
          setHasUpdate(true)
        }
      })
      .catch(() => {
        // Silently ignore — network errors, server down, etc.
      })

    return () => controller.abort()
  }, [])

  return hasUpdate
}
