import { describe, expect, it, vi } from 'vitest'

import * as predictionDb from '@/services/db/prediction.db'
import {
  createPrediction,
  updatePredictionStatus
} from '@/services/db/prediction.db'
import { placePredictionBet } from '@/services/predictions/placePredictionBet.service'

import {
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
    title: 'Test event',
    choices: [
      { choiceName: 'Yes', odds: 2, bets: [] },
      { choiceName: 'No', odds: 1.5, bets: [] }
    ],
    autolock: new Date('2026-12-01T00:00:00Z'),
    status: 'active'
  })
}

describe('placePredictionBet.service', () => {
  it('places bet and locks funds', async () => {
    await createTestUser({ balance: 500, bonusBalance: 0 })
    await seedActivePrediction('pred-happy')

    await placePredictionBet({
      userId: 'user-1',
      guildId: 'guild-1',
      predictionId: 'pred-happy',
      choiceName: 'Yes',
      amount: 100,
      minBet: 10,
      maxBet: 500
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(400)
    expect(user?.lockedBalance).toBe(100)

    const prediction = await predictionDb.getPredictionById({
      predictionId: 'pred-happy',
      guildId: 'guild-1'
    })
    const betId = prediction?.choices[0]?.bets[0]?.betId
    expect(betId).toBeTruthy()

    const tx = await Transaction.findOne({
      betId,
      type: 'bet'
    })
    expect(tx?.amount).toBe(100)
  })

  it('rejects missing prediction without reserving', async () => {
    await createTestUser({ balance: 500 })

    await expect(
      placePredictionBet({
        userId: 'user-1',
        guildId: 'guild-1',
        predictionId: 'pred-missing',
        choiceName: 'Yes',
        amount: 50,
        minBet: 10,
        maxBet: 500
      })
    ).rejects.toMatchObject({ code: 'PREDICTION_NOT_FOUND' })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(0)
  })

  it('rejects unknown choice without reserving', async () => {
    await createTestUser({ balance: 500 })
    await seedActivePrediction('pred-choice')

    await expect(
      placePredictionBet({
        userId: 'user-1',
        guildId: 'guild-1',
        predictionId: 'pred-choice',
        choiceName: 'Maybe',
        amount: 50,
        minBet: 10,
        maxBet: 500
      })
    ).rejects.toMatchObject({ code: 'CHOICE_NOT_FOUND' })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(0)
  })

  it('rejects inactive prediction without reserving', async () => {
    await createTestUser({ balance: 500 })
    await seedActivePrediction('pred-ended')
    await updatePredictionStatus({
      predictionId: 'pred-ended',
      guildId: 'guild-1',
      fromStatus: 'active',
      toStatus: 'ended'
    })

    await expect(
      placePredictionBet({
        userId: 'user-1',
        guildId: 'guild-1',
        predictionId: 'pred-ended',
        choiceName: 'Yes',
        amount: 50,
        minBet: 10,
        maxBet: 500
      })
    ).rejects.toMatchObject({ code: 'PREDICTION_NOT_ACTIVE' })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(0)
  })

  it('rejects cumulative bet above per-choice max when user already bet on choice', async () => {
    await createTestUser({ balance: 500 })
    await seedActivePrediction('pred-cumulative')

    await placePredictionBet({
      userId: 'user-1',
      guildId: 'guild-1',
      predictionId: 'pred-cumulative',
      choiceName: 'Yes',
      amount: 400,
      minBet: 10,
      maxBet: 500
    })

    await expect(
      placePredictionBet({
        userId: 'user-1',
        guildId: 'guild-1',
        predictionId: 'pred-cumulative',
        choiceName: 'Yes',
        amount: 150,
        minBet: 10,
        maxBet: 500
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(400)
  })

  it('rejects bet above per-choice max before reserve', async () => {
    await createTestUser({ balance: 500 })
    await seedActivePrediction('pred-max')

    await expect(
      placePredictionBet({
        userId: 'user-1',
        guildId: 'guild-1',
        predictionId: 'pred-max',
        choiceName: 'Yes',
        amount: 600,
        minBet: 10,
        maxBet: 500
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(0)
  })

  it('refunds when prediction bet record cannot be added', async () => {
    await createTestUser({ balance: 500 })
    await seedActivePrediction('pred-refund')

    vi.spyOn(predictionDb, 'addPredictionBet').mockResolvedValue(null)

    await expect(
      placePredictionBet({
        userId: 'user-1',
        guildId: 'guild-1',
        predictionId: 'pred-refund',
        choiceName: 'Yes',
        amount: 80,
        minBet: 10,
        maxBet: 500
      })
    ).rejects.toMatchObject({ code: 'PREDICTION_STATE_CHANGED' })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(500)
    expect(user?.lockedBalance).toBe(0)

    vi.restoreAllMocks()
  })
})
