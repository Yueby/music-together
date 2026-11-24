import type { StorageAdapter } from '../../../client/src/lib/StorageAdapter'

const memoryStorage = new Map<string, string>()

/** The slice of `sdk.localStorage` used here (async, IndexedDB-backed, scoped to this app and environment). */
export interface PersistentStore {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<unknown>
  removeItem(key: string): Promise<unknown>
  exportData?(options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<{ format: number; entries: unknown }>
}
const EXPORT_TIMEOUT_MS = 3_000
let persistent: PersistentStore | null = null
let hydrationGeneration = 0

function acceptsKey(key: string): boolean {
  return key.startsWith('mt-') && key !== 'mt-rejoin-token'
}

function isPersistedKey(key: string): boolean {
  return acceptsKey(key) && key !== 'mt-userId'
}

async function readPersistedEntries(store: PersistentStore, signal?: AbortSignal): Promise<unknown[]> {
  if (typeof store.exportData === 'function') {
    try {
      const snapshot = await store.exportData({ signal, timeoutMs: EXPORT_TIMEOUT_MS })
      if (snapshot?.format === 1 && Array.isArray(snapshot.entries)) return snapshot.entries
    } catch {
      // Older runtimes may only support reading a known key, or exportData may time out.
    }
  }
  if (signal?.aborted) return []
  try {
    return [['mt-auth-cookies', await store.getItem('mt-auth-cookies')]]
  } catch {
    return []
  }
}

/**
 * Load the persisted keys into memory and start writing changes through. Call once after the SDK is ready and before
 * the UI reads any storage: the adapter the client uses is synchronous.
 */
export async function hydratePersistentStorage(store: PersistentStore, signal?: AbortSignal): Promise<void> {
  const generation = ++hydrationGeneration
  const entries = await readPersistedEntries(store, signal)
  if (generation !== hydrationGeneration || signal?.aborted) return

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) continue
    const [key, value] = entry
    if (typeof key === 'string' && typeof value === 'string' && isPersistedKey(key) && !memoryStorage.has(key)) {
      memoryStorage.set(key, value)
    }
  }
  persistent = store
}

export const storageBackend: StorageAdapter = {
  getItem: (key) => (acceptsKey(key) ? (memoryStorage.get(key) ?? null) : null),
  setItem: (key, value) => {
    if (!acceptsKey(key)) return
    memoryStorage.set(key, value)
    if (isPersistedKey(key)) void persistent?.setItem(key, value).catch(() => {})
  },
  removeItem: (key) => {
    if (!acceptsKey(key)) return
    memoryStorage.delete(key)
    if (isPersistedKey(key)) void persistent?.removeItem(key).catch(() => {})
  },
}

/** Forget everything held in memory and stop writing through. The persisted copy is left untouched. */
export function clearMemoryStorage(): void {
  hydrationGeneration++
  persistent = null
  memoryStorage.clear()
}

export default storageBackend
