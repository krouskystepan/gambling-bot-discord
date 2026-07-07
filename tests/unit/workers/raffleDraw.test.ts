import { beforeEach, describe, expect, it, vi } from 'vitest'

import { raffleDrawJob } from '@/workers/jobs/raffleDraw.job'

vi.mock('@/services', () => ({
  getGuildConfigByGuildId: vi.fn(),
  payRaffleWinner: vi.fn(),
  refundRafflePurchase: vi.fn()
}))

vi.mock('@/services/db/raffle.db', () => ({
  getRafflesReadyToDraw: vi.fn(),
  completeRaffleDraw: vi.fn()
}))

vi.mock('@/services/worker/workerDiscordLog.service', () => ({
  postWorkerLog: vi.fn()
}))

vi.mock('@/utils/common/utils', () => ({
  sleep: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: { worker: vi.fn(), error: vi.fn() }
}))

const { getGuildConfigByGuildId, payRaffleWinner } = await import('@/services')
const { getRafflesReadyToDraw, completeRaffleDraw } = await import(
  '@/services/db/raffle.db'
)
const { postWorkerLog } = await import(
  '@/services/worker/workerDiscordLog.service'
)
const { logger } = await import('@/utils/logger')

const guildConfig = {
  globalSettings: { currencySymbol: '$', locale: 'en-US' },
  casinoSettings: { raffle: { casinoCut: 0.1 } }
}

const baseRaffle = {
  raffleId: 'raffle-1',
  drawId: 'draw-1',
  guildId: 'guild-1',
  channelId: 'channel-missing',
  ticketPrice: 10,
  maxTicketsPerUser: 10,
  nextDrawAt: new Date('2020-01-01T00:00:00Z'),
  drawIntervalMs: 86_400_000,
  participants: [
    { userId: 'winner', tickets: 3 },
    { userId: 'user-2', tickets: 2 }
  ]
}

describe('raffleDrawJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('advances the raffle schedule when the Discord channel is missing', async () => {
    vi.mocked(getRafflesReadyToDraw).mockResolvedValue([baseRaffle] as never)
    vi.mocked(getGuildConfigByGuildId).mockResolvedValue(guildConfig as never)
    vi.mocked(payRaffleWinner).mockResolvedValue(undefined as never)

    const client = {
      channels: {
        fetch: vi.fn().mockResolvedValue(null)
      }
    }

    await raffleDrawJob(client as never)

    expect(payRaffleWinner).toHaveBeenCalled()
    expect(completeRaffleDraw).toHaveBeenCalledWith(
      expect.objectContaining({
        raffleId: 'raffle-1',
        lastDrawAt: baseRaffle.nextDrawAt,
        drawId: expect.any(String)
      })
    )
    expect(logger.error).not.toHaveBeenCalled()
    expect(postWorkerLog).toHaveBeenCalledTimes(1)
    expect(postWorkerLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        worker: 'Raffles',
        title: 'Winner picked',
        level: 'warning'
      })
    )
  })
})
