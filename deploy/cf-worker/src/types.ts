export interface WorkerEnv {
  ENABLE_MAPP_AUDIO?: string
  ENABLE_COVER_PROXY?: string
  ENABLE_PUBLIC_METADATA_CACHE?: string
  MAPP_RELAY_SECRET?: string
  ALLOWED_MAPP_ORIGIN?: string
}

export interface WorkerRuntime {
  fetch: typeof fetch
  cache: Pick<Cache, 'match' | 'put'>
  createFixedLengthStream(length: number): Pick<FixedLengthStream, 'readable' | 'writable'>
}

export function isFeatureEnabled(flag: string | undefined): boolean {
  return flag !== 'false' && flag !== '0'
}
