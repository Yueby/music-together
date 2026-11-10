import type { StorageAdapter } from './StorageAdapter'

export const storageBackend: StorageAdapter = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
}

export default storageBackend
