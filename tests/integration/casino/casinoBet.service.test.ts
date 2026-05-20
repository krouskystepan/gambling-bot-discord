import { describe, expect, it } from 'vitest'

import {
  refundLockedBet,
  reserveCasinoBet,
  settleCasinoWinnings
} from '@/services/casino/casinoBet.service'

import {
  Transaction,
  User,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

describe('casinoBet.service', () => {
  it('reserves bet using bonus then cash', async () => {
    await createTestUser({ balance: 100, bonusBalance: 50 })

    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 80,
      betId: 'bet-1'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(70)
    expect(user?.bonusBalance).toBe(0)
    expect(user?.lockedBalance).toBe(80)

    const tx = await Transaction.findOne({ betId: 'bet-1', type: 'bet' })
    expect(tx?.amount).toBe(80)
  })

  it('throws when funds are insufficient', async () => {
    await createTestUser({ balance: 10, bonusBalance: 0 })

    await expect(
      reserveCasinoBet({
        userId: 'user-1',
        guildId: 'guild-1',
        totalBet: 100,
        betId: 'bet-2'
      })
    ).rejects.toThrow('INSUFFICIENT_FUNDS')
  })

  it('settles winnings and unlocks bet', async () => {
    await createTestUser({ balance: 500, lockedBalance: 100 })

    const finalBalance = await settleCasinoWinnings({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      winnings: 200,
      betId: 'bet-3'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBe(700)
    expect(finalBalance).toBe(700)

    const winTx = await Transaction.findOne({ betId: 'bet-3', type: 'win' })
    expect(winTx?.amount).toBe(200)
  })

  it('refunds locked bet back to balance', async () => {
    await createTestUser({ balance: 400, lockedBalance: 75 })

    await refundLockedBet({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 75,
      betId: 'bet-4'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(475)
    expect(user?.lockedBalance).toBe(0)

    const refundTx = await Transaction.findOne({
      betId: 'bet-4',
      type: 'refund'
    })
    expect(refundTx?.amount).toBe(75)
  })
})
