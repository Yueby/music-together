// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startMappClient } from './bootstrapClient.ts'

const fixtures = vi.hoisted(() => {
  const order: string[] = []
  const host = { connect: vi.fn(), dispose: vi.fn(), unlockAudio: vi.fn() }
  const sdk = { ready: Promise.resolve(), lifecycle: { ready: vi.fn() } }
  return {
    order,
    host,
    sdk,
    getSDK: vi.fn(),
    createHost: vi.fn(),
    install: vi.fn(),
    unbind: vi.fn(),
    mount: vi.fn(),
    unmount: vi.fn(),
  }
})
vi.mock('@discourse-mini-app/sdk', () => ({ getSDK: fixtures.getSDK }))
vi.mock('./compat/MappHost.ts', () => ({ createMappHost: fixtures.createHost }))
vi.mock('./compat/hostBinding.ts', () => ({ installMappHost: fixtures.install }))
vi.mock('../../client/src/platform/mountMappClient', () => ({ mountMappClient: fixtures.mount }))

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function flush(): Promise<void> {
  await vi.dynamicImportSettled()
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

const config = { endpoint: 'room', reviewedEndpointUrl: 'wss://rooms.example.test/room' }
const privateError = () => new Error('private JWT and endpoint details')
let root: HTMLElement
let listeners: Set<EventListenerOrEventListenerObject>
let clients: ReturnType<typeof startMappClient>[]

function start() {
  const client = startMappClient({ ...config, root, initialRoomId: 'initial-room' })
  clients.push(client)
  // Tests deliberately cancel startup; observe rejection as the production entry does.
  void client.ready.catch(() => {})
  return client
}

beforeEach(() => {
  vi.resetAllMocks()
  clients = []
  listeners = new Set()
  fixtures.order.length = 0
  document.body.replaceChildren()
  root = document.createElement('div')
  root.id = 'mapp-root'
  document.body.append(root)
  const add = window.addEventListener.bind(window)
  const remove = window.removeEventListener.bind(window)
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'pagehide') listeners.add(listener)
    add(type, listener, options)
  })
  vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener, options) => {
    if (type === 'pagehide') listeners.delete(listener)
    remove(type, listener, options)
  })
  fixtures.sdk.ready = Promise.resolve()
  fixtures.getSDK.mockImplementation(() => { fixtures.order.push('sdk'); return fixtures.sdk })
  fixtures.createHost.mockImplementation(() => { fixtures.order.push('host'); return fixtures.host })
  fixtures.install.mockImplementation(() => { fixtures.order.push('bind'); return fixtures.unbind })
  fixtures.mount.mockImplementation(async () => { fixtures.order.push('mount'); return fixtures.unmount })
  fixtures.unmount.mockImplementation(() => { fixtures.order.push('unmount') })
  fixtures.unbind.mockImplementation(() => { fixtures.order.push('unbind') })
  fixtures.host.connect.mockImplementation(() => { fixtures.order.push('connect') })
  fixtures.host.dispose.mockImplementation(async () => { fixtures.order.push('dispose') })
  fixtures.sdk.lifecycle.ready.mockImplementation(async () => { fixtures.order.push('ready') })
})

afterEach(async () => {
  for (const client of clients) await client.dispose().catch(() => {})
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('formal Mapp client startup', () => {
  it('waits for SDK and React commit before connect and platform ready, without unlocking audio', async () => {
    const sdkReady = deferred<void>()
    const commit = deferred<() => void>()
    fixtures.sdk.ready = sdkReady.promise
    fixtures.mount.mockImplementation(() => { fixtures.order.push('mount'); return commit.promise })
    const client = start()
    expect(listeners.size).toBe(1)
    expect(fixtures.order).toEqual(['sdk'])
    sdkReady.resolve()
    await flush()
    expect(fixtures.order).toEqual(['sdk', 'host', 'bind', 'mount'])
    expect(fixtures.createHost).toHaveBeenCalledWith(config)
    expect(fixtures.mount).toHaveBeenCalledWith(root, fixtures.host, 'initial-room')
    expect(fixtures.host.connect).not.toHaveBeenCalled()
    expect(fixtures.sdk.lifecycle.ready).not.toHaveBeenCalled()
    commit.resolve(fixtures.unmount)
    await client.ready
    expect(fixtures.order).toEqual(['sdk', 'host', 'bind', 'mount', 'connect', 'ready'])
    expect(fixtures.host.unlockAudio).not.toHaveBeenCalled()
    await client.dispose()
    expect(fixtures.order.slice(-3)).toEqual(['unmount', 'unbind', 'dispose'])
    expect(listeners.size).toBe(0)
  })

  it('uses the existing default root and safely creates one when absent', async () => {
    const first = startMappClient(config)
    clients.push(first)
    await first.ready
    expect(fixtures.mount.mock.calls[0]?.[0]).toBe(root)
    await first.dispose()
    root.remove()
    const second = startMappClient(config)
    clients.push(second)
    await second.ready
    const created = document.getElementById('mapp-root')
    expect(created?.tagName).toBe('DIV')
    expect(created?.parentElement).toBe(document.body)
    expect(fixtures.mount.mock.calls[1]?.[0]).toBe(created)
  })

  it('shows a fixed platform-only message when SDK is unavailable, without native fallbacks', async () => {
    const forbidden = vi.fn(() => { throw privateError() })
    vi.stubGlobal('fetch', forbidden)
    vi.stubGlobal('WebSocket', forbidden)
    vi.stubGlobal('AudioContext', forbidden)
    vi.spyOn(document, 'cookie', 'get').mockImplementation(forbidden)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(forbidden)
    fixtures.getSDK.mockImplementation(() => { throw privateError() })
    const client = start()
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    expect(root.textContent).toBe('请在 Discourse 微应用中打开此应用。MAPP_CLIENT_START_FAILED')
    expect(forbidden).not.toHaveBeenCalled()
    expect(fixtures.createHost).not.toHaveBeenCalled()
    expect(fixtures.mount).not.toHaveBeenCalled()
    expect(fixtures.sdk.lifecycle.ready).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
  })

  it.each(['sdk', 'host', 'binding', 'mount', 'connect'] as const)(
    'sanitizes %s failure, releases acquired resources and signals the rendered error page once',
    async (stage) => {
      if (stage === 'sdk') fixtures.sdk.ready = Promise.reject(privateError())
      if (stage === 'host') fixtures.createHost.mockImplementation(() => { throw privateError() })
      if (stage === 'binding') fixtures.install.mockImplementation(() => { throw privateError() })
      if (stage === 'mount') fixtures.mount.mockRejectedValue(privateError())
      if (stage === 'connect') fixtures.host.connect.mockImplementation(() => { throw privateError() })
      const client = start()
      await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
      expect(root.textContent).toBe('微应用启动失败，请重新打开。MAPP_CLIENT_START_FAILED')
      expect(fixtures.sdk.lifecycle.ready).toHaveBeenCalledOnce()
      expect(fixtures.host.dispose).toHaveBeenCalledTimes(['binding', 'mount', 'connect'].includes(stage) ? 1 : 0)
      expect(fixtures.unbind).toHaveBeenCalledTimes(['mount', 'connect'].includes(stage) ? 1 : 0)
      expect(fixtures.unmount).toHaveBeenCalledTimes(stage === 'connect' ? 1 : 0)
      if (stage === 'connect') expect(fixtures.order.indexOf('unmount')).toBeLessThan(fixtures.order.indexOf('ready'))
      expect(listeners.size).toBe(0)
    },
  )

  it('does not stop background playback on blur or visibility changes', async () => {
    const client = start()
    await client.ready
    window.dispatchEvent(new Event('blur'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fixtures.host.dispose).not.toHaveBeenCalled()
    expect(fixtures.unmount).not.toHaveBeenCalled()
    expect(listeners.size).toBe(1)
  })
})

describe('exit and late completion', () => {
  it.each(['explicit', 'pagehide'] as const)('cancels SDK wait on %s without waiting for SDK', async (exit) => {
    const sdkReady = deferred<void>()
    fixtures.sdk.ready = sdkReady.promise
    const client = start()
    if (exit === 'pagehide') window.dispatchEvent(new Event('pagehide'))
    const disposal = client.dispose()
    expect(client.dispose()).toBe(disposal)
    await disposal
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    sdkReady.resolve()
    await flush()
    expect(fixtures.createHost).not.toHaveBeenCalled()
    expect(fixtures.sdk.lifecycle.ready).not.toHaveBeenCalled()
    expect(root.textContent).toBe('')
    expect(listeners.size).toBe(0)
  })

  it('observes SDK rejection after disposal', async () => {
    const sdkReady = deferred<void>()
    fixtures.sdk.ready = sdkReady.promise
    const client = start()
    await client.dispose()
    sdkReady.reject(privateError())
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    expect(fixtures.createHost).not.toHaveBeenCalled()
  })

  it.each(['explicit', 'pagehide'] as const)('unmounts late React commit after %s, without connecting', async (exit) => {
    const commit = deferred<() => void>()
    fixtures.mount.mockReturnValue(commit.promise)
    const client = start()
    await flush()
    expect(fixtures.mount).toHaveBeenCalledOnce()
    if (exit === 'pagehide') window.dispatchEvent(new Event('pagehide'))
    await client.dispose()
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    expect(fixtures.unbind).toHaveBeenCalledOnce()
    expect(fixtures.host.dispose).toHaveBeenCalledOnce()
    commit.resolve(fixtures.unmount)
    await flush()
    expect(fixtures.unmount).toHaveBeenCalledOnce()
    expect(fixtures.host.connect).not.toHaveBeenCalled()
    expect(fixtures.sdk.lifecycle.ready).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
  })

  it('observes mount rejection after exit without an error page or platform ready', async () => {
    const commit = deferred<() => void>()
    fixtures.mount.mockReturnValue(commit.promise)
    const client = start()
    await flush()
    await client.dispose()
    commit.reject(privateError())
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    expect(fixtures.sdk.lifecycle.ready).not.toHaveBeenCalled()
    expect(root.textContent).toBe('')
  })

  it('cancels between binding and mount without calling the mounter', async () => {
    fixtures.install.mockImplementation(() => {
      window.dispatchEvent(new Event('pagehide'))
      return fixtures.unbind
    })
    const client = start()
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    expect(fixtures.mount).not.toHaveBeenCalled()
    expect(fixtures.host.connect).not.toHaveBeenCalled()
    expect(fixtures.sdk.lifecycle.ready).not.toHaveBeenCalled()
    expect(fixtures.unbind).toHaveBeenCalledOnce()
    expect(fixtures.host.dispose).toHaveBeenCalledOnce()
  })

  it.each(['explicit', 'pagehide'] as const)('cancels pending platform acknowledgement on %s', async (exit) => {
    const acknowledgement = deferred<void>()
    fixtures.sdk.lifecycle.ready.mockReturnValue(acknowledgement.promise)
    const client = start()
    await flush()
    expect(fixtures.sdk.lifecycle.ready).toHaveBeenCalledOnce()
    if (exit === 'pagehide') window.dispatchEvent(new Event('pagehide'))
    await client.dispose()
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    acknowledgement.resolve()
    await flush()
    expect(fixtures.sdk.lifecycle.ready).toHaveBeenCalledOnce()
    expect(fixtures.unmount).toHaveBeenCalledOnce()
    expect(listeners.size).toBe(0)
  })

  it('prevents ready after pagehide during failure cleanup', async () => {
    const closing = deferred<void>()
    fixtures.mount.mockRejectedValue(privateError())
    fixtures.host.dispose.mockReturnValue(closing.promise)
    const client = start()
    await flush()
    window.dispatchEvent(new Event('pagehide'))
    closing.resolve()
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    expect(fixtures.sdk.lifecycle.ready).not.toHaveBeenCalled()
    expect(root.textContent).toBe('')
    expect(listeners.size).toBe(0)
  })

  it('continues cleanup after each callback fails, exposing only a fixed disposal error', async () => {
    const client = start()
    await client.ready
    fixtures.unmount.mockImplementation(() => { fixtures.order.push('unmount'); throw privateError() })
    fixtures.unbind.mockImplementation(() => { fixtures.order.push('unbind'); throw privateError() })
    fixtures.host.dispose.mockImplementation(async () => { fixtures.order.push('dispose'); throw privateError() })
    const disposal = client.dispose()
    expect(client.dispose()).toBe(disposal)
    await expect(disposal).rejects.toThrow(/^MAPP_CLIENT_DISPOSE_FAILED$/)
    expect(fixtures.order.slice(-3)).toEqual(['unmount', 'unbind', 'dispose'])
    expect(fixtures.unmount).toHaveBeenCalledOnce()
    expect(fixtures.unbind).toHaveBeenCalledOnce()
    expect(fixtures.host.dispose).toHaveBeenCalledOnce()
    expect(listeners.size).toBe(0)
  })

  it('reports only a fixed code if cancelled late unmount throws', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const commit = deferred<() => void>()
    fixtures.mount.mockReturnValue(commit.promise)
    const client = start()
    await flush()
    await client.dispose()
    fixtures.unmount.mockImplementation(() => { throw privateError() })
    commit.resolve(fixtures.unmount)
    await flush()
    expect(log).toHaveBeenCalledExactlyOnceWith('MAPP_CLIENT_DISPOSE_FAILED')
    expect(fixtures.host.dispose).toHaveBeenCalledOnce()
  })
})

describe('bounded startup and timer cleanup', () => {
  it('times out SDK wait and ignores late SDK readiness', async () => {
    vi.useFakeTimers()
    const sdkReady = deferred<void>()
    fixtures.sdk.ready = sdkReady.promise
    const client = start()
    await vi.advanceTimersByTimeAsync(20_000)
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    sdkReady.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(fixtures.createHost).not.toHaveBeenCalled()
    expect(fixtures.sdk.lifecycle.ready).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(listeners.size).toBe(0)
  })

  it('shares the 20 second budget across SDK and React commit and unmounts a late result', async () => {
    const sdkReady = deferred<void>()
    const commit = deferred<() => void>()
    fixtures.sdk.ready = sdkReady.promise
    fixtures.mount.mockReturnValue(commit.promise)
    vi.useFakeTimers()
    const client = start()
    await vi.advanceTimersByTimeAsync(12_000)
    sdkReady.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(fixtures.mount).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(8_000)
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    expect(fixtures.host.connect).not.toHaveBeenCalled()
    expect(fixtures.host.dispose).toHaveBeenCalledOnce()
    commit.resolve(fixtures.unmount)
    await vi.advanceTimersByTimeAsync(0)
    expect(fixtures.unmount).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(listeners.size).toBe(0)
  })

  it.each(['resolve', 'reject', 'pending'] as const)('treats lifecycle %s as best effort with bounded acknowledgement', async (outcome) => {
    const acknowledgement = deferred<void>()
    fixtures.sdk.lifecycle.ready.mockReturnValue(acknowledgement.promise)
    const client = start()
    await flush()
    expect(fixtures.host.connect).toHaveBeenCalledOnce()
    if (outcome === 'resolve') acknowledgement.resolve()
    if (outcome === 'reject') acknowledgement.reject(privateError())
    if (outcome === 'pending') {
      // Switch after import/commit; the active notification timer is still a real timer.
      await new Promise((resolve) => setTimeout(resolve, 1_050))
    }
    await expect(client.ready).resolves.toBeUndefined()
    expect(fixtures.host.dispose).not.toHaveBeenCalled()
    expect(fixtures.sdk.lifecycle.ready).toHaveBeenCalledOnce()
  })

  it('bounds failure-page acknowledgement and cancels it on pagehide', async () => {
    fixtures.mount.mockRejectedValue(privateError())
    const acknowledgement = deferred<void>()
    fixtures.sdk.lifecycle.ready.mockReturnValue(acknowledgement.promise)
    const client = start()
    await flush()
    expect(root.textContent).toContain('MAPP_CLIENT_START_FAILED')
    expect(fixtures.sdk.lifecycle.ready).toHaveBeenCalledOnce()
    window.dispatchEvent(new Event('pagehide'))
    await expect(client.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    expect(listeners.size).toBe(0)
  })

  it('clears active timers on explicit SDK cancellation and after successful disposal', async () => {
    vi.useFakeTimers()
    fixtures.sdk.ready = deferred<void>().promise
    const first = start()
    expect(vi.getTimerCount()).toBe(1)
    await first.dispose()
    await expect(first.ready).rejects.toThrow(/^MAPP_CLIENT_START_FAILED$/)
    expect(vi.getTimerCount()).toBe(0)
    fixtures.sdk.ready = Promise.resolve()
    const second = start()
    await vi.advanceTimersByTimeAsync(0)
    await second.ready
    expect(vi.getTimerCount()).toBe(0)
    await second.dispose()
    expect(listeners.size).toBe(0)
  })
})
