import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packageClientApp } from './clientPackage.ts'

// Command line entry: `pnpm --filter @music-together/mapp package` (after `build`).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await packageClientApp({
    appId: process.env.MINI_APP_ID ?? '',
    version: process.env.MINI_APP_VERSION || undefined,
    roomUrl: process.env.MAPP_ROOM_URL ?? '',
  })
  console.log(`Created ${result.file} (${result.size} bytes)`)
}
