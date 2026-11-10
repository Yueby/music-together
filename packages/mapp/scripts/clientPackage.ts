import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pack, type MiniAppManifest } from '@discourse-mini-app/sdk/pack'
import { MAPP_METADATA_TARGETS } from '../../shared/src/mappMetadataTargets.ts'
import { MAPP_CLIENT_HTML, resolveMappClientTarget } from './clientConfig.ts'
import { verifyClientStyles } from './verifyClientStyles.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const PLACEHOLDER_APP_ID = '00000000-0000-7000-8000-000000000000'
const APP_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/

interface ClientPackageOptions {
  appId: string
  version?: string
  roomUrl: string
}

export function resolveClientManifest(template: MiniAppManifest, options: ClientPackageOptions): MiniAppManifest {
  if (!options.appId || options.appId === PLACEHOLDER_APP_ID) {
    throw new Error('MINI_APP_ID must be the ID assigned by the community application page')
  }
  if (!APP_ID.test(options.appId)) throw new Error('MINI_APP_ID must be a platform-assigned UUIDv7')
  const version = options.version ?? template.version
  if (version.length > 64 || !VERSION.test(version)) throw new Error('Invalid mini-app manifest version')
  const target = resolveMappClientTarget(options.roomUrl)
  return {
    format: 1,
    id: options.appId,
    version,
    ...(template.name === undefined ? {} : { name: template.name }),
    entry: 'index.html',
    script: 'app.js',
    style: 'app.css',
    // storage.* keeps the music-platform logins between sessions (the Web client uses localStorage for the same).
    permissions: ['user.read', 'audio.webAudio', 'network.websocket', 'network.request', 'storage.read', 'storage.write'],
    websockets: { roomSocket: { url: target.roomUrl, auth: 'platform' } },
    endpoints: {
      roomAudio: {
        url: `${target.serverOrigin}/api/mapp/audio`,
        method: 'GET',
        query: ['roomId', 'trackId'],
        auth: 'platform',
      },
      ...Object.fromEntries(
        Object.values(MAPP_METADATA_TARGETS).map((metadata) => [
          metadata.endpoint,
          {
            url: `${target.serverOrigin}${metadata.path}`,
            method: 'GET' as const,
            query: [...metadata.queryKeys],
            auth: 'platform' as const,
          },
        ]),
      ),
    },
  }
}

export async function packageClientApp(options: ClientPackageOptions & { directory?: string }) {
  const directory = options.directory ?? root
  const template = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')) as MiniAppManifest
  const manifest = resolveClientManifest(template, options)
  const files = {
    'index.html': MAPP_CLIENT_HTML,
    'strings.json': '{}',
    'app.js': await readFile(resolve(directory, 'dist/client-web/app.js')),
    'app.css': await readFile(resolve(directory, 'dist/client-web/app.css')),
  }
  verifyClientStyles(files['app.css'])
  return pack({ manifest, files, outputDirectory: resolve(directory, 'dist/client-package') })
}
