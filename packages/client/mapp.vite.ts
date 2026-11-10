import type { UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import { fileURLToPath } from 'node:url'
import { resolveMappClientTarget } from '../mapp/scripts/clientConfig.ts'

/** Uses the client workspace's existing build dependencies; never changes Web build output. */
export function createMappClientConfig(roomUrl: string | undefined, version: string): UserConfig {
  const target = resolveMappClientTarget(roomUrl)
  const clientSource = fileURLToPath(new URL('./src/', import.meta.url))
  const compat = fileURLToPath(new URL('../mapp/src/compat/', import.meta.url))
  const alias = [
    ['@/lib/playbackSoundFactory', `${compat}hostModules/playbackSoundFactory.ts`],
    ['@/lib/metadataFetch', `${compat}hostModules/metadataFetch.ts`],
    ['@/lib/artwork', `${compat}hostModules/artwork.ts`],
    ['@/lib/RoomCommands', `${compat}hostModules/RoomCommands.ts`],
    ['@/lib/roomCheck', `${compat}hostModules/roomCheck.ts`],
    ['@/lib/audioUnlock', `${compat}hostModules/audioUnlock.ts`],
    ['@/lib/hostRuntime', `${compat}hostModules/hostRuntime.ts`],
    ['@/lib/storageBackend', `${compat}storageBackend.ts`],
    ['@', clientSource],
  ].map(([find, replacement]) => ({ find, replacement }))
  return {
    base: './',
    plugins: [react(), tailwindcss(), wasm()],
    resolve: { alias },
    define: {
      __MAPP_ROOM_ENDPOINT__: JSON.stringify(target.endpoint),
      __MAPP_ROOM_URL__: JSON.stringify(target.roomUrl),
      __APP_VERSION__: JSON.stringify(version),
      'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.env.VITE_SERVER_URL': JSON.stringify(target.serverOrigin),
    },
    build: {
      outDir: 'dist/client-web',
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: false,
      cssCodeSplit: false,
      lib: {
        entry: fileURLToPath(new URL('../mapp/src/clientMain.ts', import.meta.url)),
        name: 'MusicTogetherClient',
        formats: ['iife'],
        fileName: () => 'app.js',
        cssFileName: 'app',
      },
      // Vite 8/Rolldown: lazy routes stay inside the one reviewed script.
      rolldownOptions: { output: { codeSplitting: false } },
    },
  }
}
