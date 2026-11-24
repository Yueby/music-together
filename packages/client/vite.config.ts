import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { readFileSync } from 'fs'

const rootPkg = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg'],
      manifest: {
        name: 'Music Together - 一起听歌',
        short_name: 'Music Together',
        description: '在线同步听歌平台，与好友实时共享音乐与歌词',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    target: 'esnext', // 原生支持 top-level await，避免 vite-plugin-top-level-await 与 manualChunks 冲突
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router)[\\/]/ },
            { name: 'vendor-socket', test: /node_modules[\\/]socket\.io-client[\\/]/ },
            { name: 'vendor-motion', test: /node_modules[\\/]motion[\\/]/ },
            {
              name: 'vendor-ui',
              test: /node_modules[\\/](radix-ui|sonner|vaul|class-variance-authority)[\\/]/,
            },
            { name: 'vendor-pixi', test: /node_modules[\\/]@pixi[\\/]/ },
          ],
        },
      },
    },
  },
})
