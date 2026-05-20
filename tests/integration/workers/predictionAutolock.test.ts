import { describe, expect, it } from 'vitest'

import {
  createPrediction,
  getPredictionToLock,
  updatePredictionStatus
} from '@/services/db/prediction.db'

import { Prediction, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

describe('prediction autolock data flow', () => {
  it('finds active predictions past autolock and ends them', async () => {
    await createPrediction({
      predictionId: 'pred-lock-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      creatorId: 'mod-1',
      title: 'Lock me',
      choices: [{ choiceName: 'A', odds: 2, bets: [] }],
      autolock: new Date('2020-01-01T00:00:00Z'),
      status: 'active'
    })

    await createPrediction({
      predictionId: 'pred-future',
      guildId: 'guild-1',
      channelId: 'channel-1',
      creatorId: 'mod-1',
      title: 'Stay active',
      choices: [{ choiceName: 'B', odds: 2, bets: [] }],
      autolock: new Date('2099-01-01T00:00:00Z'),
      status: 'active'
    })

    const toLock = await getPredictionToLock({
      status: 'active',
      useAutolock: true
    })

    expect(toLock.map((p) => p.predictionId)).toContain('pred-lock-1')
    expect(toLock.map((p) => p.predictionId)).not.toContain('pred-future')

    const updated = await updatePredictionStatus({
      predictionId: 'pred-lock-1',
      guildId: 'guild-1',
      fromStatus: 'active',
      toStatus: 'ended'
    })

    expect(updated?.status).toBe('ended')

    const stillActive = await Prediction.findOne({ predictionId: 'pred-future' })
    expect(stillActive?.status).toBe('active')
  })
})
