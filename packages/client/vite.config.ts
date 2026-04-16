import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import path from 'path'
import { readFileSync } from 'fs'

const rootPkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), wasm()],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext', // 原生支持 top-level await，避免 vite-plugin-top-level-await 与 manualChunks 冲突
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-socket': ['socket.io-client'],
          'vendor-motion': ['motion'],
          'vendor-ui': ['radix-ui', 'sonner', 'vaul', 'class-variance-authority'],
          'vendor-pixi': [
            '@pixi/app',
            '@pixi/core',
            '@pixi/display',
            '@pixi/sprite',
            '@pixi/filter-blur',
            '@pixi/filter-bulge-pinch',
            '@pixi/filter-color-matrix',
          ],
        },
      },
    },
  },
})
