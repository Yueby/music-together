import type { StorageAdapter } from '../../../client/src/lib/StorageAdapter'

const memoryStorage = new Map<string, string>()

function acceptsKey(key: string): boolean {
  return key.startsWith('mt-') && key !== 'mt-auth-cookies' && key !== 'mt-rejoin-token'
}

export const storageBackend: StorageAdapter = {
  getItem: (key) => (acceptsKey(key) ? memoryStorage.get(key) ?? null : null),
  setItem: (key, value) => {
    if (acceptsKey(key)) memoryStorage.set(key, value)
  },
  removeItem: (key) => {
    if (acceptsKey(key)) memoryStorage.delete(key)
  },
}

export function clearMemoryStorage(): void {
  memoryStorage.clear()
}

export default storageBackend
