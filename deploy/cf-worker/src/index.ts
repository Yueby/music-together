import { COVER_PROXY_PATH, handleCoverProxy } from './handlers/coverProxy.js'
import { handleMappAudio, MAPP_AUDIO_PATH } from './handlers/mappAudio.js'
import { handlePublicMetadata, isPublicMetadataPath } from './handlers/publicMetadata.js'
import { isFeatureEnabled, type WorkerEnv, type WorkerRuntime } from './types.js'

const defaultRuntime: WorkerRuntime = {
  fetch: (input, init) => fetch(input, init),
  get cache() { return caches.default },
  createFixedLengthStream: (length) => new FixedLengthStream(length),
}

export function createWorkerHandler(runtime: WorkerRuntime = defaultRuntime) {
  return async (request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> => {
    const { pathname } = new URL(request.url)
    if (pathname === MAPP_AUDIO_PATH && isFeatureEnabled(env.ENABLE_MAPP_AUDIO)) {
      return handleMappAudio(request, env, ctx, runtime)
    }
    if ((pathname === COVER_PROXY_PATH || pathname === COVER_PROXY_PATH + '/') && isFeatureEnabled(env.ENABLE_COVER_PROXY)) {
      return handleCoverProxy(request, env, ctx, runtime)
    }
    if (isPublicMetadataPath(pathname) && isFeatureEnabled(env.ENABLE_PUBLIC_METADATA_CACHE)) {
      return handlePublicMetadata(request, ctx, runtime)
    }
    return runtime.fetch(request)
  }
}

export default { fetch: createWorkerHandler() }
