import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
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
