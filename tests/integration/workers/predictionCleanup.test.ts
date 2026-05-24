import { describe, expect, it } from 'vitest'

import {
  createPrediction,
  deletePrediction,
  getOldPredictions
} from '@/services/db/prediction.db'

import { Prediction, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

describe('prediction cleanup data flow', () => {
  it('finds old canceled/paid predictions and deletes them', async () => {
    await createPrediction({
      predictionId: 'pred-old-paid',
      guildId: 'guild-1',
      channelId: 'channel-1',
      creatorId: 'mod-1',
      title: 'Old paid',
      choices: [{ choiceName: 'A', odds: 2, bets: [] }],
      status: 'paid'
    })
    await Prediction.collection.updateOne(
      { predictionId: 'pred-old-paid' },
      { $set: { updatedAt: new Date('2020-01-01T00:00:00Z') } }
    )

    await createPrediction({
      predictionId: 'pred-recent-paid',
      guildId: 'guild-1',
      channelId: 'channel-1',
      creatorId: 'mod-1',
      title: 'Recent paid',
      choices: [{ choiceName: 'B', odds: 2, bets: [] }],
      status: 'paid'
    })

    const old = await getOldPredictions({
      statuses: ['canceled', 'paid'],
      olderThanDays: 7
    })

    expect(old.map((p) => p.predictionId)).toContain('pred-old-paid')
    expect(old.map((p) => p.predictionId)).not.toContain('pred-recent-paid')

    await deletePrediction({ predictionId: 'pred-old-paid' })

    expect(
      await Prediction.findOne({ predictionId: 'pred-old-paid' })
    ).toBeNull()
    expect(
      await Prediction.findOne({ predictionId: 'pred-recent-paid' })
    ).toBeTruthy()
  })
})
