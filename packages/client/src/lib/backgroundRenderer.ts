import type { HostRuntime } from './hostRuntime'

/**
 * The PixiJS renderer needs `new Function`, which hosts under a strict CSP / Trusted Types reject.
 * Such hosts always get the plain-WebGL mesh renderer; otherwise the user's setting decides.
 */
export function usesMeshRenderer(setting: string, host: Pick<HostRuntime, 'pixiBackground'>): boolean {
  return setting === 'mesh' || !host.pixiBackground
}
