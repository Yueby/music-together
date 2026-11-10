import type { StorageAdapter } from '../../../client/src/lib/StorageAdapter'

const memoryStorage = new Map<string, string>()

/**
 * Everything is held in memory. Only these keys are also written through to the SDK's persistent, app-scoped storage:
 * the music-platform logins, so the mini-app can restore them like the Web client does with localStorage. The rejoin
 * ticket is deliberately never persisted (it expires within a minute), and nothing is ever written to native storage.
 */
const PERSISTED_KEYS: ReadonlySet<string> = new Set(['mt-auth-cookies'])

/** The slice of `sdk.localStorage` used here (async, IndexedDB-backed, scoped to this app and environment). */
export interface PersistentStore {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<unknown>
  removeItem(key: string): Promise<unknown>
}
let persistent: PersistentStore | null = null

function acceptsKey(key: string): boolean {
  return key.startsWith('mt-') && key !== 'mt-rejoin-token'
}

/**
 * Load the persisted keys into memory and start writing changes through. Call once after the SDK is ready and before
 * the UI reads any storage: the adapter the client uses is synchronous. Failures leave a working memory-only store.
 */
export async function hydratePersistentStorage(store: PersistentStore): Promise<void> {
  for (const key of PERSISTED_KEYS) {
    try {
      const value = await store.getItem(key)
      if (typeof value === 'string' && !memoryStorage.has(key)) memoryStorage.set(key, value)
    } catch {
      // Unreadable storage must not stop the app; the user simply logs in again.
    }
  }
  persistent = store
}

export const storageBackend: StorageAdapter = {
  getItem: (key) => (acceptsKey(key) ? (memoryStorage.get(key) ?? null) : null),
  setItem: (key, value) => {
    if (!acceptsKey(key)) return
    memoryStorage.set(key, value)
    if (PERSISTED_KEYS.has(key)) void persistent?.setItem(key, value).catch(() => {})
  },
  removeItem: (key) => {
    if (!acceptsKey(key)) return
    memoryStorage.delete(key)
    if (PERSISTED_KEYS.has(key)) void persistent?.removeItem(key).catch(() => {})
  },
}

/** Forget everything held in memory and stop writing through. The persisted copy is left untouched. */
export function clearMemoryStorage(): void {
  persistent = null
  memoryStorage.clear()
}

export default storageBackend
