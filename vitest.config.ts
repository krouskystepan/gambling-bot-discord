import { defineConfig } from 'vitest/config'

import path from 'node:path'

/**
 * Coverage: all economy logic under services/ + utils/, minus explicit opt-outs.
 * New money files are included automatically — add tests (or add to coverageExclude).
 */
const coverageExclude = [
  'src/**/index.ts',

  // DB / services not in test scope yet
  'src/services/db/vip.db.ts',
  'src/services/db/atmRequest.db.ts',
  'src/services/db/blackjackGame.db.ts',
  'src/services/db/guildConfiguration.db.ts',
  'src/services/db/base.db.ts',
  'src/services/user/checkUserRegistration.service.ts',
  'src/services/guildConfiguration/**',
  'src/services/vip/**',

  // Utils: Discord, RNG, render-only, misc
  'src/utils/logger.ts',
  'src/utils/devGuilds.ts',
  'src/utils/discord/**',
  'src/utils/common/utils.ts',
  'src/utils/common/userCooldown.ts',
  'src/utils/casino/rng.ts',
  'src/utils/casino/**/render.ts',
  'src/utils/casino/blackjack/deck.ts',
  'src/utils/casino/blackjack/state.ts',
  'src/utils/casino/blackjack/customId.ts',
  'src/utils/casino/roulette/helpers.ts',
  'src/utils/casino/roulette/types.ts'
]

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
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
