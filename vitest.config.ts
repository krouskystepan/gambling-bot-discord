import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // High value disables yellow "slow test" duration labels (type is number only)
    slowTestThreshold: 60_000,
    testTimeout: 30_000,
    hookTimeout: 120_000
  }
})
