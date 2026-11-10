import type { MappHost } from './MappHost.ts'

let binding: { host: MappHost } | undefined

/** Bootstrap owns the host; selecting client modules never creates another owner. */
export function installMappHost(host: MappHost): () => void {
  if (binding) throw new Error('MAPP_HOST_ALREADY_BOUND')
  const current = { host }
  binding = current
  return () => {
    if (binding === current) binding = undefined
  }
}

export function getMappHost(): MappHost {
  if (!binding) throw new Error('MAPP_BINDINGS_REQUIRED')
  return binding.host
}
