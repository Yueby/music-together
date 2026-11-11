import { SERVER_URL } from '@/lib/config'
import { metadataFetch } from '@/lib/metadataFetch'

/** A music API answer that was not 2xx. Callers map `status` (400 unsupported, 401 login needed, 404 not found, …). */
export class ApiError extends Error {
  constructor(readonly status: number) {
    super(String(status))
    this.name = 'ApiError'
  }
}

/** The HTTP status of a failed music API call, if the error is one. */
export function statusOf(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined
}

/**
 * GET `/api/music/<path>` with the caller's credentials, as JSON. One place for the host transport (the mini-app
 * reads through its SDK instead of fetch) and for how a failure is reported.
 */
export async function getMusicJson<T>(
  path: string,
  params: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))
  const res = await metadataFetch(`${SERVER_URL}/api/music/${path}?${query}`, { signal, credentials: 'include' })
  if (!res.ok) throw new ApiError(res.status)
  return (await res.json()) as T
}
