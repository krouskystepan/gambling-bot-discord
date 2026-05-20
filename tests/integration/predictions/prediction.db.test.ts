import { describe, expect, it } from 'vitest'

import {
  addPredictionBet,
  createPrediction,
  getPredictionById,
  updatePredictionStatus
} from '@/services/db/prediction.db'

import { Prediction, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

describe('prediction.db', () => {
  it('creates and fetches a prediction', async () => {
    await createPrediction({
      predictionId: 'pred-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      creatorId: 'mod-1',
      title: 'Who wins?',
      choices: [
        { choiceName: 'A', odds: 2, bets: [] },
        { choiceName: 'B', odds: 1.5, bets: [] }
      ],
      autolock: new Date('2026-06-01T00:00:00Z'),
      status: 'active'
    })

    const prediction = await getPredictionById({
      predictionId: 'pred-1',
      guildId: 'guild-1'
    })

    expect(prediction?.title).toBe('Who wins?')
    expect(prediction?.choices).toHaveLength(2)
  })

  it('adds a bet to a choice', async () => {
    await createPrediction({
      predictionId: 'pred-2',
      guildId: 'guild-1',
      channelId: 'channel-1',
      creatorId: 'mod-1',
      title: 'Total points',
      choices: [{ choiceName: 'Over', odds: 2, bets: [] }],
      autolock: new Date('2026-06-01T00:00:00Z'),
      status: 'active'
    })

    await addPredictionBet({
      predictionId: 'pred-2',
      guildId: 'guild-1',
      choiceName: 'Over',
      userId: 'user-1',
      amount: 250
    })

    const updated = await Prediction.findOne({ predictionId: 'pred-2' })
    expect(updated?.choices[0]?.bets).toHaveLength(1)
    expect(updated?.choices[0]?.bets[0]).toMatchObject({
      userId: 'user-1',
      amount: 250
    })
  })

  it('updates prediction status atomically', async () => {
    await createPrediction({
      predictionId: 'pred-3',
      guildId: 'guild-1',
      channelId: 'channel-1',
      creatorId: 'mod-1',
      title: 'Match winner',
      choices: [{ choiceName: 'Home', odds: 2, bets: [] }],
      autolock: new Date('2026-06-01T00:00:00Z'),
      status: 'active'
    })

    const updated = await updatePredictionStatus({
      predictionId: 'pred-3',
      guildId: 'guild-1',
      fromStatus: 'active',
      toStatus: 'ended'
    })

    expect(updated?.status).toBe('ended')

    const wrongTransition = await updatePredictionStatus({
      predictionId: 'pred-3',
      guildId: 'guild-1',
      fromStatus: 'active',
      toStatus: 'paid'
    })

    expect(wrongTransition).toBeNull()
  })
})
