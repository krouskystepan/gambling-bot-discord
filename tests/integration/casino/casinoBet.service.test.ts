import { USER_BANNED_ERROR } from 'gambling-bot-shared/user'
import { describe, expect, it, vi } from 'vitest'

import TransactionModel from '@/models/Transaction'
import {
  refundLockedBet,
  releaseExcessLockedBalance,
  reserveCasinoBet,
  settleCasinoWinnings,
  settleRpsGameAtomic,
  spendCasinoBalance
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
      betId: 'bet-1',
      game: 'dice'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(70)
    expect(user?.bonusBalance).toBe(0)
    expect(user?.lockedBalance).toBe(80)

    const tx = await Transaction.findOne({ referenceId: 'bet-1', type: 'bet' })
    expect(tx?.amount).toBe(80)
  })

  it('throws USER_BANNED on reserve', async () => {
    await createTestUser({ balance: 500, banned: true })

    await expect(
      reserveCasinoBet({
        userId: 'user-1',
        guildId: 'guild-1',
        totalBet: 10,
        betId: 'reserve-banned',
        game: 'dice'
      })
    ).rejects.toThrow(USER_BANNED_ERROR)
  })

  it('throws USER_NOT_FOUND on reserve', async () => {
    await expect(
      reserveCasinoBet({
        userId: 'missing',
        guildId: 'guild-1',
        totalBet: 10,
        betId: 'reserve-missing',
        game: 'dice'
      })
    ).rejects.toThrow('USER_NOT_FOUND')
  })

  it('reserves when bonusBalance is null on user document', async () => {
    await User.collection.insertOne({
      userId: 'null-bonus',
      guildId: 'guild-1',
      balance: 100,
      lockedBalance: 0,
      bonusBalance: null
    })

    await reserveCasinoBet({
      userId: 'null-bonus',
      guildId: 'guild-1',
      totalBet: 20,
      betId: 'null-bonus-bet',
      game: 'dice'
    })

    const user = await User.findOne({
      userId: 'null-bonus',
      guildId: 'guild-1'
    })
    expect(user?.balance).toBe(80)
    expect(user?.lockedBalance).toBe(20)
  })

  it('reserves using bonus only when cash balance is zero', async () => {
    await createTestUser({ balance: 0, bonusBalance: 80 })

    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 50,
      betId: 'bonus-only',
      game: 'dice'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(0)
    expect(user?.bonusBalance).toBe(30)
    expect(user?.lockedBalance).toBe(50)
  })

  it('throws when funds are insufficient', async () => {
    await createTestUser({ balance: 10, bonusBalance: 0 })

    await expect(
      reserveCasinoBet({
        userId: 'user-1',
        guildId: 'guild-1',
        totalBet: 100,
        betId: 'bet-2',
        game: 'dice'
      })
    ).rejects.toThrow('INSUFFICIENT_FUNDS')
  })

  it('throws USER_NOT_FOUND on settle', async () => {
    await expect(
      settleCasinoWinnings({
        userId: 'missing',
        guildId: 'guild-1',
        totalBet: 10,
        winnings: 0,
        betId: 'settle-missing',
        game: 'dice'
      })
    ).rejects.toThrow('USER_NOT_FOUND')
  })

  it('settles with zero winnings without creating win transaction', async () => {
    await createTestUser({ balance: 500, lockedBalance: 100 })

    const finalBalance = await settleCasinoWinnings({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      winnings: 0,
      betId: 'bet-zero-win',
      game: 'dice'
    })

    expect(finalBalance).toBe(500)
    expect(
      await Transaction.countDocuments({
        referenceId: 'bet-zero-win',
        type: 'win'
      })
    ).toBe(0)
  })

  it('settles winnings and unlocks bet', async () => {
    await createTestUser({ balance: 500, lockedBalance: 100 })

    const finalBalance = await settleCasinoWinnings({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      winnings: 200,
      betId: 'bet-3',
      game: 'dice'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBe(700)
    expect(finalBalance).toBe(700)

    const winTx = await Transaction.findOne({
      referenceId: 'bet-3',
      type: 'win'
    })
    expect(winTx?.amount).toBe(200)
  })

  it('refunds locked bet back to balance', async () => {
    await createTestUser({ balance: 400, lockedBalance: 75 })

    await refundLockedBet({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 75,
      betId: 'bet-4',
      game: 'dice'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(475)
    expect(user?.lockedBalance).toBe(0)

    const refundTx = await Transaction.findOne({
      referenceId: 'bet-4',
      type: 'refund'
    })
    expect(refundTx?.amount).toBe(75)
  })

  it('does not refund when locked balance is insufficient', async () => {
    await createTestUser({ balance: 400, lockedBalance: 10 })

    await refundLockedBet({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 75,
      betId: 'bet-5',
      game: 'dice'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(400)
    expect(user?.lockedBalance).toBe(10)
    expect(await Transaction.countDocuments({ referenceId: 'bet-5' })).toBe(0)
  })

  it('settles without unlocking when locked balance is below totalBet', async () => {
    await createTestUser({ balance: 500, lockedBalance: 50 })

    const finalBalance = await settleCasinoWinnings({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      winnings: 200,
      betId: 'bet-6',
      game: 'dice'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(50)
    expect(user?.balance).toBe(500)
    expect(finalBalance).toBe(550)
    expect(
      await Transaction.countDocuments({ referenceId: 'bet-6', type: 'win' })
    ).toBe(0)
  })

  it('spends casino balance using bonus then cash', async () => {
    await createTestUser({ balance: 100, bonusBalance: 40 })

    await spendCasinoBalance({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 60,
      betId: 'spend-1',
      game: 'dice'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(80)
    expect(user?.bonusBalance).toBe(0)
  })

  it('throws USER_BANNED on spendCasinoBalance', async () => {
    await createTestUser({ balance: 500, banned: true })

    await expect(
      spendCasinoBalance({
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 10,
        betId: 'spend-banned',
        game: 'dice'
      })
    ).rejects.toThrow(USER_BANNED_ERROR)
  })

  it('throws USER_NOT_FOUND on spendCasinoBalance', async () => {
    await expect(
      spendCasinoBalance({
        userId: 'missing',
        guildId: 'guild-1',
        amount: 10,
        betId: 'spend-missing',
        game: 'dice'
      })
    ).rejects.toThrow('USER_NOT_FOUND')
  })

  it('spends when bonusBalance is null on user document', async () => {
    await User.collection.insertOne({
      userId: 'spend-null-bonus',
      guildId: 'guild-1',
      balance: 50,
      lockedBalance: 0,
      bonusBalance: null
    })

    await spendCasinoBalance({
      userId: 'spend-null-bonus',
      guildId: 'guild-1',
      amount: 20,
      betId: 'spend-null-bonus-bet',
      game: 'dice'
    })

    const user = await User.findOne({
      userId: 'spend-null-bonus',
      guildId: 'guild-1'
    })
    expect(user?.balance).toBe(30)
  })

  it('spends using bonus only when cash balance is zero', async () => {
    await createTestUser({ balance: 0, bonusBalance: 60 })

    await spendCasinoBalance({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 40,
      betId: 'spend-bonus-only',
      game: 'dice'
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(0)
    expect(user?.bonusBalance).toBe(20)
  })

  it('throws INSUFFICIENT_FUNDS on spendCasinoBalance', async () => {
    await createTestUser({ balance: 10, bonusBalance: 0 })

    await expect(
      spendCasinoBalance({
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 50,
        betId: 'spend-2',
        game: 'dice'
      })
    ).rejects.toThrow('INSUFFICIENT_FUNDS')
  })

  it('unlocks bet without double pay when win transaction already exists', async () => {
    await createTestUser({ balance: 400, lockedBalance: 100 })
    await Transaction.create({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 200,
      type: 'win',
      source: 'casino',
      referenceId: 'bet-idem'
    })

    const finalBalance = await settleCasinoWinnings({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      winnings: 200,
      betId: 'bet-idem',
      game: 'dice'
    })

    expect(finalBalance).toBe(400)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBe(400)
    expect(
      await Transaction.countDocuments({ referenceId: 'bet-idem', type: 'win' })
    ).toBe(1)
  })

  it('rethrows non-Error values from spend insert', async () => {
    await createTestUser({ balance: 200, bonusBalance: 0 })
    vi.spyOn(TransactionModel, 'create').mockRejectedValueOnce('spend-fail')

    await expect(
      spendCasinoBalance({
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 25,
        betId: 'spend-non-error',
        game: 'dice'
      })
    ).rejects.toBe('spend-fail')

    vi.restoreAllMocks()
  })

  it('rethrows non-duplicate errors from spend insert', async () => {
    await createTestUser({ balance: 200, bonusBalance: 0 })
    vi.spyOn(TransactionModel, 'create').mockRejectedValueOnce(
      new Error('db down')
    )

    await expect(
      spendCasinoBalance({
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 25,
        betId: 'spend-err',
        game: 'dice'
      })
    ).rejects.toThrow('db down')

    vi.restoreAllMocks()
  })

  it('throws DUPLICATE_BET when spend insert hits duplicate key', async () => {
    await createTestUser({ balance: 200, bonusBalance: 0 })

    const duplicateError = Object.assign(new Error('duplicate key'), {
      code: 11_000
    })
    vi.spyOn(TransactionModel, 'create').mockRejectedValueOnce(duplicateError)

    await expect(
      spendCasinoBalance({
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 25,
        betId: 'dup-spend-insert',
        game: 'dice'
      })
    ).rejects.toThrow('DUPLICATE_BET')

    vi.restoreAllMocks()
  })

  it('throws DUPLICATE_BET on second spend with same bet id', async () => {
    await createTestUser({ balance: 200, bonusBalance: 0 })

    await spendCasinoBalance({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 25,
      betId: 'dup-spend',
      game: 'dice'
    })

    await expect(
      spendCasinoBalance({
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 25,
        betId: 'dup-spend',
        game: 'dice'
      })
    ).rejects.toThrow('DUPLICATE_BET')
  })

  it('rethrows non-Error values from bet insert', async () => {
    await createTestUser({ balance: 200, bonusBalance: 0 })
    vi.spyOn(TransactionModel, 'create').mockRejectedValueOnce('not-an-error')

    await expect(
      reserveCasinoBet({
        userId: 'user-1',
        guildId: 'guild-1',
        totalBet: 25,
        betId: 'reserve-non-error',
        game: 'dice'
      })
    ).rejects.toBe('not-an-error')

    vi.restoreAllMocks()
  })

  it('rethrows non-duplicate errors from bet insert', async () => {
    await createTestUser({ balance: 200, bonusBalance: 0 })
    vi.spyOn(TransactionModel, 'create').mockRejectedValueOnce(
      new Error('db down')
    )

    await expect(
      reserveCasinoBet({
        userId: 'user-1',
        guildId: 'guild-1',
        totalBet: 25,
        betId: 'reserve-err',
        game: 'dice'
      })
    ).rejects.toThrow('db down')

    vi.restoreAllMocks()
  })

  it('throws DUPLICATE_BET when bet insert hits duplicate key', async () => {
    await createTestUser({ balance: 200, bonusBalance: 0 })

    const duplicateError = Object.assign(new Error('duplicate key'), {
      code: 11_000
    })
    vi.spyOn(TransactionModel, 'create').mockRejectedValueOnce(duplicateError)

    await expect(
      reserveCasinoBet({
        userId: 'user-1',
        guildId: 'guild-1',
        totalBet: 25,
        betId: 'dup-insert',
        game: 'dice'
      })
    ).rejects.toThrow('DUPLICATE_BET')

    vi.restoreAllMocks()
  })

  it('throws DUPLICATE_BET on second reserve with same bet id', async () => {
    await createTestUser({ balance: 200, bonusBalance: 0 })

    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 25,
      betId: 'dup-bet',
      game: 'dice'
    })

    await expect(
      reserveCasinoBet({
        userId: 'user-1',
        guildId: 'guild-1',
        totalBet: 25,
        betId: 'dup-bet',
        game: 'dice'
      })
    ).rejects.toThrow('DUPLICATE_BET')

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(25)
    expect(
      await Transaction.countDocuments({ referenceId: 'dup-bet', type: 'bet' })
    ).toBe(1)
  })

  it('settles RPS when player two wins', async () => {
    await createTestUser({ userId: 'p1', balance: 0, lockedBalance: 100 })
    await createTestUser({
      userId: 'p2',
      guildId: 'guild-1',
      balance: 0,
      lockedBalance: 100
    })

    await settleRpsGameAtomic({
      p1UserId: 'p1',
      p1GuildId: 'guild-1',
      p2UserId: 'p2',
      p2GuildId: 'guild-1',
      betAmount: 100,
      winnerUserId: 'p2',
      houseEdge: 0,
      betId: 'rps-p2-win',
      game: 'dice'
    })

    const winner = await User.findOne({ userId: 'p2', guildId: 'guild-1' })
    expect(winner?.balance).toBe(200)
  })

  it('skips RPS settle when win transaction already exists', async () => {
    await createTestUser({ userId: 'p1', balance: 0, lockedBalance: 100 })
    await createTestUser({
      userId: 'p2',
      guildId: 'guild-1',
      balance: 0,
      lockedBalance: 100
    })
    await Transaction.create({
      userId: 'p1',
      guildId: 'guild-1',
      amount: 200,
      type: 'win',
      source: 'casino',
      referenceId: 'rps-idem'
    })

    await settleRpsGameAtomic({
      p1UserId: 'p1',
      p1GuildId: 'guild-1',
      p2UserId: 'p2',
      p2GuildId: 'guild-1',
      betAmount: 100,
      winnerUserId: 'p1',
      houseEdge: 0,
      betId: 'rps-idem',
      game: 'dice'
    })

    const p1 = await User.findOne({ userId: 'p1', guildId: 'guild-1' })
    expect(p1?.lockedBalance).toBe(100)
    expect(p1?.balance).toBe(0)
  })

  it('throws USER_NOT_FOUND on RPS settle', async () => {
    await createTestUser({ userId: 'p1', balance: 0, lockedBalance: 100 })

    await expect(
      settleRpsGameAtomic({
        p1UserId: 'p1',
        p1GuildId: 'guild-1',
        p2UserId: 'missing',
        p2GuildId: 'guild-1',
        betAmount: 100,
        winnerUserId: 'p1',
        houseEdge: 0,
        betId: 'rps-missing',
        game: 'dice'
      })
    ).rejects.toThrow('USER_NOT_FOUND')
  })

  it('throws USER_NOT_FOUND on refund', async () => {
    await expect(
      refundLockedBet({
        userId: 'missing',
        guildId: 'guild-1',
        amount: 50,
        betId: 'refund-missing',
        game: 'dice'
      })
    ).rejects.toThrow('USER_NOT_FOUND')
  })

  it('settles RPS with winner payout and casino cut', async () => {
    await createTestUser({
      userId: 'p1',
      balance: 0,
      lockedBalance: 100
    })
    await createTestUser({
      userId: 'p2',
      guildId: 'guild-1',
      balance: 0,
      lockedBalance: 100
    })

    await settleRpsGameAtomic({
      p1UserId: 'p1',
      p1GuildId: 'guild-1',
      p2UserId: 'p2',
      p2GuildId: 'guild-1',
      betAmount: 100,
      winnerUserId: 'p1',
      houseEdge: 0.1,
      betId: 'rps-1',
      game: 'dice'
    })

    const winner = await User.findOne({ userId: 'p1', guildId: 'guild-1' })
    const loser = await User.findOne({ userId: 'p2', guildId: 'guild-1' })
    expect(winner?.lockedBalance).toBe(0)
    expect(winner?.balance).toBe(180)
    expect(loser?.lockedBalance).toBe(0)
    expect(loser?.balance).toBe(0)
  })

  it('settles RPS as draw returning locked bets', async () => {
    await createTestUser({
      userId: 'p1',
      balance: 50,
      lockedBalance: 100
    })
    await createTestUser({
      userId: 'p2',
      guildId: 'guild-1',
      balance: 50,
      lockedBalance: 100
    })

    await settleRpsGameAtomic({
      p1UserId: 'p1',
      p1GuildId: 'guild-1',
      p2UserId: 'p2',
      p2GuildId: 'guild-1',
      betAmount: 100,
      winnerUserId: null,
      houseEdge: 0.1,
      betId: 'rps-draw',
      game: 'dice'
    })

    const p1 = await User.findOne({ userId: 'p1', guildId: 'guild-1' })
    const p2 = await User.findOne({ userId: 'p2', guildId: 'guild-1' })
    expect(p1?.balance).toBe(150)
    expect(p1?.lockedBalance).toBe(0)
    expect(p2?.balance).toBe(150)
    expect(p2?.lockedBalance).toBe(0)
  })

  it('skips RPS settle when only first player has insufficient lock', async () => {
    await createTestUser({ userId: 'p1', balance: 0, lockedBalance: 30 })
    await createTestUser({
      userId: 'p2',
      guildId: 'guild-1',
      balance: 0,
      lockedBalance: 100
    })

    await settleRpsGameAtomic({
      p1UserId: 'p1',
      p1GuildId: 'guild-1',
      p2UserId: 'p2',
      p2GuildId: 'guild-1',
      betAmount: 100,
      winnerUserId: 'p2',
      houseEdge: 0,
      betId: 'rps-p1-low-lock',
      game: 'dice'
    })

    const p1 = await User.findOne({ userId: 'p1', guildId: 'guild-1' })
    expect(p1?.lockedBalance).toBe(30)
  })

  it('skips RPS settle when only second player has insufficient lock', async () => {
    await createTestUser({ userId: 'p1', balance: 0, lockedBalance: 100 })
    await createTestUser({
      userId: 'p2',
      guildId: 'guild-1',
      balance: 0,
      lockedBalance: 40
    })

    await settleRpsGameAtomic({
      p1UserId: 'p1',
      p1GuildId: 'guild-1',
      p2UserId: 'p2',
      p2GuildId: 'guild-1',
      betAmount: 100,
      winnerUserId: 'p1',
      houseEdge: 0,
      betId: 'rps-p2-low-lock',
      game: 'dice'
    })

    const p1 = await User.findOne({ userId: 'p1', guildId: 'guild-1' })
    const p2 = await User.findOne({ userId: 'p2', guildId: 'guild-1' })
    expect(p1?.lockedBalance).toBe(100)
    expect(p2?.lockedBalance).toBe(40)
  })

  it('skips RPS settle when locked balance is insufficient', async () => {
    await createTestUser({
      userId: 'p1',
      balance: 100,
      lockedBalance: 50
    })
    await createTestUser({
      userId: 'p2',
      guildId: 'guild-1',
      balance: 100,
      lockedBalance: 100
    })

    await settleRpsGameAtomic({
      p1UserId: 'p1',
      p1GuildId: 'guild-1',
      p2UserId: 'p2',
      p2GuildId: 'guild-1',
      betAmount: 100,
      winnerUserId: 'p2',
      houseEdge: 0,
      betId: 'rps-skip',
      game: 'dice'
    })

    const p1 = await User.findOne({ userId: 'p1', guildId: 'guild-1' })
    expect(p1?.lockedBalance).toBe(50)
    expect(
      await Transaction.countDocuments({ referenceId: 'rps-skip', type: 'win' })
    ).toBe(0)
  })

  it('is idempotent when RPS win transaction already exists', async () => {
    await createTestUser({
      userId: 'p1',
      balance: 0,
      lockedBalance: 100
    })
    await createTestUser({
      userId: 'p2',
      guildId: 'guild-1',
      balance: 0,
      lockedBalance: 100
    })

    await Transaction.create({
      userId: 'p1',
      guildId: 'guild-1',
      amount: 180,
      type: 'win',
      source: 'casino',
      referenceId: 'rps-idem'
    })

    await settleRpsGameAtomic({
      p1UserId: 'p1',
      p1GuildId: 'guild-1',
      p2UserId: 'p2',
      p2GuildId: 'guild-1',
      betAmount: 100,
      winnerUserId: 'p1',
      houseEdge: 0.1,
      betId: 'rps-idem',
      game: 'dice'
    })

    const p1 = await User.findOne({ userId: 'p1', guildId: 'guild-1' })
    expect(p1?.lockedBalance).toBe(100)
    expect(p1?.balance).toBe(0)
  })

  it('throws USER_NOT_FOUND on releaseExcessLockedBalance', async () => {
    await expect(
      releaseExcessLockedBalance({
        userId: 'missing',
        guildId: 'guild-1',
        amount: 10
      })
    ).rejects.toThrow('USER_NOT_FOUND')
  })

  it('no-ops releaseExcessLockedBalance when locked balance is zero', async () => {
    await createTestUser({ balance: 100, lockedBalance: 0 })

    await releaseExcessLockedBalance({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 50
    })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(100)
    expect(user?.lockedBalance).toBe(0)
    expect(await Transaction.countDocuments({ userId: 'user-1' })).toBe(0)
  })
})
