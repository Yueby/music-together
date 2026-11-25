interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

declare class FixedLengthStream {
  constructor(length: number)
  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>
}

interface CacheStorage {
  readonly default: Cache
}

interface RequestInit {
  cf?: {
    cacheTtl?: number
    cacheEverything?: boolean
  }
}
