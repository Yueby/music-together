/// <reference path="../src/env.d.ts" />
import { vi } from 'vitest'
import { createWorkerHandler } from '../src/index.js'
import type { WorkerRuntime } from '../src/types.js'

function fixedLengthStream(length: number) {
  let written = 0
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      written += chunk.byteLength
      if (written > length) throw new Error('Too many bytes')
      controller.enqueue(chunk)
    },
    flush() {
      if (written !== length) throw new Error('Too few bytes')
    },
  })
}

export function fixture() {
  const entries = new Map<string, { body: ArrayBuffer | null; headers: Headers; status: number }>()
  const pending: Promise<unknown>[] = []
  const ctx = { waitUntil: vi.fn((work: Promise<unknown>) => { pending.push(work) }) }
  const cache = {
    match: vi.fn<Cache['match']>(async (key) => {
      const entry = entries.get(String(key))
      return entry ? new Response(entry.body, entry) : undefined
    }),
    put: vi.fn<Cache['put']>(async (key, response) => {
      const body = response.body === null ? null : await response.arrayBuffer()
      entries.set(String(key), { body, headers: new Headers(response.headers), status: response.status })
    }),
  }
  const runtime = {
    fetch: vi.fn<WorkerRuntime['fetch']>(),
    cache,
    createFixedLengthStream: vi.fn(fixedLengthStream),
  }
  return { runtime, ctx, pending, entries, handler: createWorkerHandler(runtime) }
}
