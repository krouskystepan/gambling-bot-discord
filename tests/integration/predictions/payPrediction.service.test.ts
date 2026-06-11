import { describe, expect, it } from 'vitest'

import {
  createPrediction,
  updatePredictionStatus
} from '@/services/db/prediction.db'
import { placePredictionBet } from '@/services/predictions/placePredictionBet.service'
import { payPrediction } from '@/services/predictions/payPrediction.service'

import {
  Prediction,
  Transaction,
  User,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

const seedActivePrediction = async (predictionId: string) => {
  await createPrediction({
    predictionId,
    guildId: 'guild-1',
    channelId: 'channel-1',
    creatorId: 'mod-1',
    title: 'Payout test',
    choices: [
      { choiceName: 'Yes', odds: 2, bets: [] },
      { choiceName: 'No', odds: 1.5, bets: [] }
    ],
    autolock: null,
    status: 'active'
  })
}

const endPrediction = async (predictionId: string) => {
  await updatePredictionStatus({
    predictionId,
    guildId: 'guild-1',
    fromStatus: 'active',
    toStatus: 'ended'
  })
}

describe('payPrediction.service', () => {
  it('pays all winners with unique win transactions', async () => {
    await createTestUser({ userId: 'user-1', balance: 1000 })
    await createTestUser({ userId: 'user-2', balance: 1000 })
    await seedActivePrediction('pred-win')

    await placePredictionBet({
      userId: 'user-1',
      guildId: 'guild-1',
      predictionId: 'pred-win',
      choiceName: 'Yes',
      amount: 100,
      minBet: 10,
      maxBet: 500
    })

    await placePredictionBet({
      userId: 'user-2',
      guildId: 'guild-1',
      predictionId: 'pred-win',
      choiceName: 'Yes',
      amount: 50,
      minBet: 10,
      maxBet: 500
    })

    await placePredictionBet({
      userId: 'user-1',
      guildId: 'guild-1',
      predictionId: 'pred-win',
      choiceName: 'No',
      amount: 40,
      minBet: 10,
      maxBet: 500
    })

    await endPrediction('pred-win')

    const result = await payPrediction({
      predictionId: 'pred-win',
      guildId: 'guild-1',
      winnerChoice: 'Yes'
    })

    expect(result.ok).toBe(true)
    if (!result.ok || result.outcome !== 'paid') return

    expect(result.prediction.status).toBe('paid')

    const wins = await Transaction.find({ type: 'win' })
    expect(wins).toHaveLength(2)

    const user1 = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    const user2 = await User.findOne({ userId: 'user-2', guildId: 'guild-1' })
    expect(user1?.lockedBalance).toBe(0)
    expect(user2?.lockedBalance).toBe(0)
    expect(user1?.balance).toBe(1060)
    expect(user2?.balance).toBe(1050)
  })

  it('allows only one concurrent payout', async () => {
    await createTestUser({ userId: 'user-1', balance: 500 })
    await seedActivePrediction('pred-race')

    await placePredictionBet({
      userId: 'user-1',
      guildId: 'guild-1',
      predictionId: 'pred-race',
      choiceName: 'Yes',
      amount: 100,
      minBet: 10,
      maxBet: 500
    })

    await endPrediction('pred-race')

    const [first, second] = await Promise.all([
      payPrediction({
        predictionId: 'pred-race',
        guildId: 'guild-1',
        winnerChoice: 'Yes'
      }),
      payPrediction({
        predictionId: 'pred-race',
        guildId: 'guild-1',
        winnerChoice: 'Yes'
      })
    ])

    const successes = [first, second].filter((result) => result.ok)
    expect(successes).toHaveLength(1)

    const prediction = await Prediction.findOne({ predictionId: 'pred-race' })
    expect(prediction?.status).toBe('paid')

    const wins = await Transaction.find({ type: 'win' })
    expect(wins).toHaveLength(1)
  })

  it('is idempotent on retry after paid status', async () => {
    await createTestUser({ userId: 'user-1', balance: 500 })
    await seedActivePrediction('pred-retry')

    await placePredictionBet({
      userId: 'user-1',
      guildId: 'guild-1',
      predictionId: 'pred-retry',
      choiceName: 'Yes',
      amount: 80,
      minBet: 10,
      maxBet: 500
    })

    await endPrediction('pred-retry')

    const first = await payPrediction({
      predictionId: 'pred-retry',
      guildId: 'guild-1',
      winnerChoice: 'Yes'
    })
    expect(first.ok).toBe(true)

    const second = await payPrediction({
      predictionId: 'pred-retry',
      guildId: 'guild-1',
      winnerChoice: 'Yes'
    })

    expect(second).toEqual({ ok: false, code: 'ALREADY_HANDLED' })
  })

  it('refunds all bets and marks paid when winner has no bets', async () => {
    await createTestUser({ userId: 'user-1', balance: 500 })
    await seedActivePrediction('pred-refund')

    await placePredictionBet({
      userId: 'user-1',
      guildId: 'guild-1',
      predictionId: 'pred-refund',
      choiceName: 'No',
      amount: 120,
      minBet: 10,
      maxBet: 500
    })

    await endPrediction('pred-refund')

    const result = await payPrediction({
      predictionId: 'pred-refund',
      guildId: 'guild-1',
      winnerChoice: 'Yes'
    })

    expect(result).toMatchObject({ ok: true, outcome: 'refunded' })

    const prediction = await Prediction.findOne({ predictionId: 'pred-refund' })
    expect(prediction?.status).toBe('paid')

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(500)
    expect(user?.lockedBalance).toBe(0)

    const refunds = await Transaction.find({ type: 'refund' })
    expect(refunds).toHaveLength(1)
  })
})
