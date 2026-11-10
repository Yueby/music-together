export interface MappClientTarget {
  endpoint: 'roomSocket'
  roomUrl: string
  serverOrigin: string
}

/** A public reviewed configuration value, never a signed URL or identity token. */
export function resolveMappClientTarget(value?: string): MappClientTarget {
  try {
    if (!value || value.length > 2048 || !value.startsWith('wss://') || /[^\x21-\x7e]|\\|#/.test(value))
      throw new Error()
    const url = new URL(value)
    const authorityEnd = value.indexOf('/', 'wss://'.length)
    const rawPath = authorityEnd < 0 ? '' : value.slice(authorityEnd).split('?')[0]
    const entries = [...url.searchParams]
    if (
      url.protocol !== 'wss:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      rawPath !== '/socket.io/' ||
      url.pathname !== '/socket.io/' ||
      entries.length !== 2 ||
      url.searchParams.getAll('EIO').length !== 1 ||
      url.searchParams.get('EIO') !== '4' ||
      url.searchParams.getAll('transport').length !== 1 ||
      url.searchParams.get('transport') !== 'websocket'
    )
      throw new Error()
    return {
      endpoint: 'roomSocket',
      roomUrl: `wss://${url.host}/socket.io/?EIO=4&transport=websocket`,
      serverOrigin: `https://${url.host}`,
    }
  } catch {
    throw new Error('MAPP_CLIENT_TARGET_REJECTED')
  }
}

export const MAPP_CLIENT_HTML = '<main id="mapp-root" role="application" aria-label="Music Together"></main>'
