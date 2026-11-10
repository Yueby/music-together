import './cspValidation.ts'
import { getSDK, type MiniAppSDK } from '@discourse-mini-app/sdk'
import { createMappHost, type MappHost } from './compat/MappHost.ts'
import { installMappHost } from './compat/hostBinding.ts'

export interface MappClientOptions {
  endpoint: string
  reviewedEndpointUrl: string
  root?: HTMLElement
  initialRoomId?: string
}

const START_TIMEOUT_MS = 20_000
const LIFECYCLE_TIMEOUT_MS = 1_000
const startError = () => new Error('MAPP_CLIENT_START_FAILED')
const disposeError = () => new Error('MAPP_CLIENT_DISPOSE_FAILED')

/** One caller owns one startup. Host owns all session, transport and audio resources. */
export function startMappClient(options: MappClientOptions): {
  ready: Promise<void>
  dispose(): Promise<void>
} {
  const deadline = Date.now() + START_TIMEOUT_MS
  const pending = new Set<() => void>()
  let stopped = false
  let exited = false
  let disposal: Promise<void> | undefined
  let host: MappHost | undefined
  let unbind: (() => void) | undefined
  let unmount: (() => void) | undefined
  let root = options.root
  let sdk: MiniAppSDK | undefined
  let lifecycleAttempted = false

  // Observe both outcomes even when cancellation/timeout wins; no late SDK rejection escapes.
  function bounded<T>(task: () => T | PromiseLike<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false
      const finish = (complete: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        pending.delete(cancel)
        complete()
      }
      const cancel = () => finish(() => reject(startError()))
      const timer = setTimeout(cancel, Math.max(0, timeoutMs))
      pending.add(cancel)
      try {
        Promise.resolve(task()).then(
          (value) => finish(() => resolve(value)),
          () => finish(() => reject(startError())),
        )
      } catch {
        cancel()
      }
    })
  }

  function assertActive(): void {
    if (stopped || Date.now() >= deadline) throw startError()
  }

  function cleanup(): Promise<void> {
    if (disposal) return disposal
    stopped = true
    for (const cancel of pending) cancel()
    // Publish before executing callbacks, which may re-enter dispose().
    disposal = Promise.resolve().then(async () => {
      let failed = false
      const detach = unmount
      const release = unbind
      const owner = host
      unmount = undefined
      unbind = undefined
      host = undefined
      try {
        detach?.()
      } catch {
        failed = true
      }
      try {
        release?.()
      } catch {
        failed = true
      }
      try {
        await owner?.dispose()
      } catch {
        failed = true
      }
      if (failed) throw disposeError()
    })
    return disposal
  }

  function dispose(): Promise<void> {
    exited = true
    window.removeEventListener('pagehide', onPageHide)
    // Also cancel error-page lifecycle notification if failure cleanup already completed.
    for (const cancel of pending) cancel()
    return cleanup()
  }

  function onPageHide(): void {
    void dispose().catch(() => {})
  }

  async function notifyReady(): Promise<void> {
    if (exited || !sdk || lifecycleAttempted) return
    lifecycleAttempted = true
    try {
      await bounded(() => sdk!.lifecycle.ready(), LIFECYCLE_TIMEOUT_MS)
    } catch {
      // Platform acknowledgement is best effort, not a prerequisite for rendering.
    }
  }

  // Register before getSDK(), any await, or calling into application-owned code.
  window.addEventListener('pagehide', onPageHide)
  const ready = (async () => {
    try {
      if (!root) {
        root = document.getElementById('mapp-root') ?? document.createElement('div')
        if (!root.id) root.id = 'mapp-root'
        if (!root.parentNode) document.body.append(root)
      }
      sdk = getSDK()
      assertActive()
      await bounded(() => sdk!.ready, deadline - Date.now())
      assertActive()
      host = createMappHost({ endpoint: options.endpoint, reviewedEndpointUrl: options.reviewedEndpointUrl })
      assertActive()
      unbind = installMappHost(host)
      assertActive()
      const { mountMappClient } = await bounded(
        () => import('../../client/src/platform/mountMappClient'),
        deadline - Date.now(),
      )
      assertActive()
      await bounded(
        () => Promise.resolve(mountMappClient(root!, host!, options.initialRoomId)).then((detach) => {
          if (stopped) {
            // A cancelled React commit may still finish. It must never acquire a new host.
            try {
              detach()
            } catch {
              console.error('MAPP_CLIENT_DISPOSE_FAILED')
            }
          } else {
            unmount = detach
          }
        }),
        deadline - Date.now(),
      )
      assertActive()
      host.connect()
      assertActive()
      await notifyReady()
      if (exited) throw startError()
    } catch {
      try {
        try {
          await cleanup()
        } catch {
          // The public disposal promise retains its fixed cleanup failure code.
        }
        if (!exited) {
          if (root) {
            root.textContent = sdk
              ? '微应用启动失败，请重新打开。MAPP_CLIENT_START_FAILED'
              : '请在 Discourse 微应用中打开此应用。MAPP_CLIENT_START_FAILED'
          }
          // Failure teardown is not a user exit: the platform may display this error page.
          await notifyReady()
        }
      } finally {
        window.removeEventListener('pagehide', onPageHide)
      }
      throw startError()
    }
  })()

  return { ready, dispose }
}
