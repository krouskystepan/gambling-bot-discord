import { DiscordAPIError } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { predictionAutolockJob } from '@/workers/jobs/predictionAutolock.job'

vi.mock('@/services', () => ({
  getPredictionToLock: vi.fn(),
  updatePredictionStatus: vi.fn()
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

const { getPredictionToLock, updatePredictionStatus } = await import(
  '@/services'
)
const { postWorkerLog } = await import(
  '@/services/worker/workerDiscordLog.service'
)
const { logger } = await import('@/utils/logger')

const basePrediction = {
  predictionId: 'pred-1',
  guildId: 'guild-1',
  channelId: 'channel-missing'
}

describe('predictionAutolockJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ends predictions in the database even when the Discord channel is missing', async () => {
    vi.mocked(getPredictionToLock).mockResolvedValue([basePrediction] as never)
    vi.mocked(updatePredictionStatus).mockResolvedValue({
      ...basePrediction,
      status: 'ended'
    } as never)

    const client = {
      channels: {
        fetch: vi.fn().mockRejectedValue(
          new DiscordAPIError(
            { message: 'Unknown Channel', code: 10003 },
            404,
            10003,
            'GET',
            'https://discord.com/api/v10/channels/channel-missing',
            {}
          )
        )
      }
    }

    await predictionAutolockJob(client as never)

    expect(updatePredictionStatus).toHaveBeenCalledWith({
      predictionId: 'pred-1',
      guildId: 'guild-1',
      fromStatus: 'active',
      toStatus: 'ended'
    })
    expect(logger.error).not.toHaveBeenCalled()
    expect(postWorkerLog).toHaveBeenCalledWith(client, {
      guildId: 'guild-1',
      worker: 'Predictions',
      title: 'Closed 1 prediction(s)',
      description:
        'Predictions past their deadline were closed for new bets.\n\n**1** could not be updated in Discord.',
      level: 'warning'
    })
  })
})
