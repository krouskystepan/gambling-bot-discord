import { vi } from 'vitest'

vi.mock('@/utils/logger', () => ({
  logger: {
    boot: vi.fn(),
    ready: vi.fn(),
    worker: vi.fn(),
    event: vi.fn(),
    error: vi.fn()
  }
}))

/**
 * Fail tests on unexpected process warnings (e.g. deprecations).
 */
const warningPattern =
  /MONGOOSE|DeprecationWarning|eslint-disable|ExperimentalWarning/

process.on('warning', (warning) => {
  if (
    warningPattern.test(warning.name) ||
    warningPattern.test(warning.message)
  ) {
    throw new Error(`Unexpected warning: ${warning.message}`)
  }
})
