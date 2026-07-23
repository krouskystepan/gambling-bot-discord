import { defineConfig } from 'vitest/config'

import path from 'node:path'

/** 100% coverage on src/services/** and src/utils/** except coverageExclude (barrels, infra, embeds, render, types). RNG: rng.ts; rules: engine/math/path. */
const devExclude = [
  'src/services/dev/**',
  'src/app/commands/(mod)/(dev)/**',
  'src/utils/devAccess.ts',
  'src/utils/devGuilds.ts'
]

const coverageExclude = [
  'src/**/index.ts',
  'src/utils/db/connect.ts',

  'src/utils/logger.ts',
  ...devExclude,
  'src/utils/discord/createEmbed.ts',
  'src/utils/discord/customEmotes.ts',
  'src/services/casino/casinoSlashOptions.ts',

  'src/utils/casino/**/render.ts',
  'src/utils/casino/**/playRound.ts',
  'src/utils/casino/**/types.ts'
]

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/dev/**'],
    setupFiles: ['tests/setup.ts'],
    fileParallelism: false,
    slowTestThreshold: 60_000,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/services/**/*.ts', 'src/utils/**/*.ts'],
      exclude: coverageExclude,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
})
