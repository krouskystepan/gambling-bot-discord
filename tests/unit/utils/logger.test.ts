import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockError = vi.hoisted(() => vi.fn())
const mockInfo = vi.hoisted(() => vi.fn())

vi.mock('pino', () => {
  const pinoFn = vi.fn(() => ({
    info: mockInfo,
    error: mockError
  }))
  return {
    default: Object.assign(pinoFn, {
      stdTimeFunctions: {
        isoTime: () => `,"time":"${new Date().toISOString()}"`
      }
    })
  }
})

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules()
    mockError.mockClear()
    mockInfo.mockClear()
    vi.stubEnv('NODE_ENV', 'test')
    delete process.env.LOG_LEVEL
    vi.doUnmock('@/utils/logger')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doMock('@/utils/logger', () => ({
      logger: {
        boot: vi.fn(),
        ready: vi.fn(),
        worker: vi.fn(),
        event: vi.fn(),
        error: vi.fn()
      }
    }))
  })

  it('serializes Error in logger.error(message, err)', async () => {
    const { logger } = await import('@/utils/logger')
    const err = new Error('test failure')

    logger.error('Something failed', err)

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'ERROR', err }),
      'Something failed'
    )
  })

  it('serializes structured context in logger.error(context, message)', async () => {
    const { logger } = await import('@/utils/logger')

    logger.error(
      { command: 'ping', userId: '123', guildId: '456' },
      'Unexpected interaction error'
    )

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'ERROR',
        command: 'ping',
        userId: '123',
        guildId: '456'
      }),
      'Unexpected interaction error'
    )
  })

  it('logs structured events via logger.event(context, message)', async () => {
    const { logger } = await import('@/utils/logger')

    logger.event(
      { action: 'balance_deposit', actorId: '1', amount: 100 },
      'Admin balance deposit'
    )

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'EVENT',
        action: 'balance_deposit',
        actorId: '1',
        amount: 100
      }),
      'Admin balance deposit'
    )
  })
})
