import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { MappHost } from '../../../mapp/src/compat/MappHost'
import { resetAllRoomState } from '@/lib/resetStores'
import { MappApp } from './MappApp'

export const MAPP_RENDER_FAILED = 'MAPP_RENDER_FAILED'

interface MountObserverProps {
  onMounted: () => void
}

function MountObserver({ onMounted }: MountObserverProps) {
  useEffect(() => {
    onMounted()
  }, [onMounted])

  return null
}

export function mountMappClient(element: HTMLElement, host: MappHost, initialRoomId?: string): Promise<() => void> {
  return new Promise((resolve, reject) => {
    let settled = false
    let isUnmounted = false
    let root: ReturnType<typeof createRoot> | null = null

    const handleMounted = () => {
      if (settled || isUnmounted) return
      settled = true
      resolve(unmount)
    }

    const fail = () => {
      if (settled) return
      settled = true
      const failedRoot = root
      root = null
      // React reports uncaught errors while finishing a render; release it after that stack.
      queueMicrotask(() => {
        try {
          failedRoot?.unmount()
        } catch {
          /* Failure cleanup is best effort. */
        }
        reject(new Error(MAPP_RENDER_FAILED))
      })
    }

    const unmount = () => {
      if (isUnmounted) return
      isUnmounted = true
      root?.unmount()
      root = null
    }

    try {
      resetAllRoomState()

      root = createRoot(element, {
        onUncaughtError: () => {
          fail()
        },
      })

      root.render(
        <StrictMode>
          <MappApp host={host} initialRoomId={initialRoomId} />
          <MountObserver onMounted={handleMounted} />
        </StrictMode>,
      )
    } catch {
      fail()
    }
  })
}
