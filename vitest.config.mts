import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'packages/client/src'),
    },
  },
  test: {
    include: ['packages/**/*.test.{ts,tsx}', 'deploy/cf-worker/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    clearMocks: true,
  },
})
