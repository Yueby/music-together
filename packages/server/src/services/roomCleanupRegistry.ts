const cleanupHooks = new Map<string, (roomId: string) => void>()

export function registerRoomCleanup(name: string, fn: (roomId: string) => void): () => void {
  const hook = (roomId: string) => fn(roomId)
  cleanupHooks.set(name, hook)
  return () => {
    if (cleanupHooks.get(name) === hook) cleanupHooks.delete(name)
  }
}

export function getRoomCleanupHooks(): ReadonlyMap<string, (roomId: string) => void> {
  return cleanupHooks
}
