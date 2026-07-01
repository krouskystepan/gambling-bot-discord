import { describe, expect, it } from 'vitest'

import { reserveCasinoBet } from '@/services/casino/casinoBet.service'
import {
  attachAtmRequestMessage,
  createAtmRequest
} from '@/services/db/atmRequest.db'
import {
  getBlackjackGameByUserAndGuild,
  upsertBlackjackGame
} from '@/services/db/blackjackGame.db'
import {
  createGuildConfiguration,
  getAllGuildConfigIds
} from '@/services/db/guildConfiguration.db'
import {
  createPrediction,
  updatePredictionStatus
} from '@/services/db/prediction.db'
import { upsertRaffle } from '@/services/db/raffle.db'
import { createTransaction } from '@/services/db/transaction.db'
import { createVip } from '@/services/db/vip.db'
import { runGuildOrphanCleanup } from '@/services/guild/guildOrphanCleanup.service'
import { placePredictionBet } from '@/services/predictions/placePredictionBet.service'

import { card } from '../../helpers/cards'
import {
  AtmRequest,
  Prediction,
  Raffle,
  Transaction,
  User,
  VipRoom,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

const GUILD_ID = 'guild-orphan'

const seedGuild = async () => {
  await createGuildConfiguration({ guildId: GUILD_ID })
}

const seedActivePrediction = async (predictionId: string) => {
  await createPrediction({
    predictionId,
    guildId: GUILD_ID,
    channelId: 'channel-1',
    creatorId: 'mod-1',
    title: 'Orphan cleanup test',
    choices: [{ choiceName: 'Yes', odds: 2, bets: [] }],
    autolock: null,
    status: 'active'
  })
}

describe('runGuildOrphanCleanup', () => {
  it('cancels active predictions and refunds locked bets', async () => {
    await seedGuild()
    await createTestUser({ userId: 'user-1', balance: 500, guildId: GUILD_ID })
    await seedActivePrediction('pred-orphan')

    await placePredictionBet({
      userId: 'user-1',
      guildId: GUILD_ID,
      predictionId: 'pred-orphan',
      choiceName: 'Yes',
      amount: 100,
      minBet: 10,
      maxBet: 500
    })

    const summary = await runGuildOrphanCleanup({ guildId: GUILD_ID })

    expect(summary.predictions).toBe(1)
    expect(summary.errors).toEqual([])

    const prediction = await Prediction.findOne({ predictionId: 'pred-orphan' })
    expect(prediction?.status).toBe('canceled')

    const user = await User.findOne({ userId: 'user-1', guildId: GUILD_ID })
    expect(user?.balance).toBe(500)
    expect(user?.lockedBalance).toBe(0)
  })

  it('rolls back paying predictions before canceling', async () => {
    await seedGuild()
    await createTestUser({ userId: 'user-1', balance: 500, guildId: GUILD_ID })
    await seedActivePrediction('pred-paying')

    await placePredictionBet({
      userId: 'user-1',
      guildId: GUILD_ID,
      predictionId: 'pred-paying',
      choiceName: 'Yes',
      amount: 80,
      minBet: 10,
      maxBet: 500
    })

    await updatePredictionStatus({
      predictionId: 'pred-paying',
      guildId: GUILD_ID,
      fromStatus: 'active',
      toStatus: 'ended'
    })

    await updatePredictionStatus({
      predictionId: 'pred-paying',
      guildId: GUILD_ID,
      fromStatus: 'ended',
      toStatus: 'paying'
    })

    const summary = await runGuildOrphanCleanup({ guildId: GUILD_ID })

    expect(summary.predictions).toBe(1)

    const prediction = await Prediction.findOne({ predictionId: 'pred-paying' })
    expect(prediction?.status).toBe('canceled')
  })

  it('cancels active raffles and refunds tickets', async () => {
    await seedGuild()
    await createTestUser({ userId: 'user-1', balance: 100, guildId: GUILD_ID })

    await upsertRaffle({
      raffleId: 'raffle-orphan',
      drawId: 'draw-orphan',
      guildId: GUILD_ID,
      creatorId: 'mod-1',
      channelId: 'channel-1',
      ticketPrice: 10,
      maxTicketsPerUser: 5,
      nextDrawAt: new Date('2099-01-01T00:00:00Z'),
      drawIntervalMs: 86_400_000
    })

    await Raffle.updateOne(
      { raffleId: 'raffle-orphan' },
      { $set: { participants: [{ userId: 'user-1', tickets: 2 }] } }
    )

    const summary = await runGuildOrphanCleanup({ guildId: GUILD_ID })

    expect(summary.raffles).toBe(1)

    const raffle = await Raffle.findOne({ raffleId: 'raffle-orphan' })
    expect(raffle?.status).toBe('canceled')

    const user = await User.findOne({ userId: 'user-1', guildId: GUILD_ID })
    expect(user?.balance).toBe(120)
  })

  it('refunds blackjack games and deletes them', async () => {
    await seedGuild()
    await createTestUser({ userId: 'user-1', balance: 1000, guildId: GUILD_ID })

    await reserveCasinoBet({
      userId: 'user-1',
      guildId: GUILD_ID,
      totalBet: 100,
      betId: 'bet-orphan-bj',
      game: 'blackjack'
    })

    await upsertBlackjackGame({
      userId: 'user-1',
      guildId: GUILD_ID,
      channelId: 'channel-1',
      messageId: 'msg-1',
      betId: 'bet-orphan-bj',
      deck: [card('2', 2)],
      deckIndex: 1,
      hands: [
        {
          cards: [card('10', 10), card('8', 8)],
          betAmount: 100,
          finished: false,
          isSplitHand: false
        }
      ],
      activeHandIndex: 0,
      phase: 'PLAYER',
      dealerCards: [card('10', 10), card('7', 7)]
    })

    const summary = await runGuildOrphanCleanup({ guildId: GUILD_ID })

    expect(summary.blackjack).toBe(1)

    const game = await getBlackjackGameByUserAndGuild({
      userId: 'user-1',
      guildId: GUILD_ID
    })
    expect(game).toBeNull()

    const user = await User.findOne({ userId: 'user-1', guildId: GUILD_ID })
    expect(user?.balance).toBe(1000)
    expect(user?.lockedBalance).toBe(0)
  })

  it('deletes VIP rooms for the guild', async () => {
    await seedGuild()

    await createVip({
      ownerId: 'user-1',
      guildId: GUILD_ID,
      channelId: 'vip-ch-1',
      expiresAt: new Date('2099-01-01T00:00:00Z')
    })

    const summary = await runGuildOrphanCleanup({ guildId: GUILD_ID })

    expect(summary.vipRooms).toBe(1)
    expect(await VipRoom.countDocuments({ guildId: GUILD_ID })).toBe(0)
  })

  it('rejects pending ATM requests', async () => {
    await seedGuild()

    await createAtmRequest({
      requestId: 'atm-orphan-1',
      userId: 'user-1',
      guildId: GUILD_ID,
      type: 'deposit',
      amount: 100,
      account: 'acc-1'
    })

    await attachAtmRequestMessage('atm-orphan-1', 'log-ch', 'log-msg')

    const summary = await runGuildOrphanCleanup({ guildId: GUILD_ID })

    expect(summary.atmRejected).toBe(1)

    const request = await AtmRequest.findOne({ requestId: 'atm-orphan-1' })
    expect(request?.status).toBe('rejected')
    expect(request?.handledBy).toBe('system')
    expect(request?.notes).toBe('Bot left guild')
  })

  it('keeps users and unrelated transactions', async () => {
    await seedGuild()
    await createTestUser({ userId: 'user-1', balance: 250, guildId: GUILD_ID })

    await createTransaction({
      userId: 'user-1',
      guildId: GUILD_ID,
      amount: 50,
      type: 'deposit',
      source: 'manual',
      referenceId: 'legacy-tx-1'
    })

    await runGuildOrphanCleanup({ guildId: GUILD_ID })

    expect(await User.countDocuments({ guildId: GUILD_ID })).toBe(1)
    expect(
      await Transaction.countDocuments({ referenceId: 'legacy-tx-1' })
    ).toBe(1)
  })

  it('is idempotent on already-clean guilds', async () => {
    await seedGuild()

    const first = await runGuildOrphanCleanup({ guildId: GUILD_ID })
    const second = await runGuildOrphanCleanup({ guildId: GUILD_ID })

    expect(first).toEqual({
      predictions: 0,
      raffles: 0,
      blackjack: 0,
      vipRooms: 0,
      atmRejected: 0,
      errors: []
    })
    expect(second).toEqual(first)
  })
})

describe('getAllGuildConfigIds', () => {
  it('returns every configured guild id', async () => {
    await createGuildConfiguration({ guildId: 'guild-a' })
    await createGuildConfiguration({ guildId: 'guild-b' })

    const guildIds = await getAllGuildConfigIds()

    expect(guildIds).toEqual(expect.arrayContaining(['guild-a', 'guild-b']))
    expect(guildIds).toHaveLength(2)
  })
})
