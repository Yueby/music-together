import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { createMappClientConfig } from '../client/mapp.vite.ts'

const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'))

/**
 * The forum mini-app is the existing React client built as one IIFE script plus one stylesheet.
 * Only `vite build` needs the reviewed room URL; other commands (e.g. Vitest) load an empty config.
 */
export default defineConfig(({ command }) =>
  command === 'build'
    ? createMappClientConfig(process.env.MAPP_ROOM_URL, process.env.MINI_APP_VERSION || manifest.version)
    : {},
)
