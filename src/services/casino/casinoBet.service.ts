import type { CasinoGameId } from 'gambling-bot-shared'
import { createCasinoBetService } from 'gambling-bot-shared/services'
import mongoose from 'mongoose'

import Transaction from '@/models/Transaction'
import User from '@/models/User'

const sharedCasinoBet = createCasinoBetService({
  userModel: User,
  transactionModel: Transaction
})

export const {
  refundLockedBet,
  settleCasinoWinnings,
  refundRafflePurchase,
  payRaffleWinner
} = sharedCasinoBet

export async function reserveCasinoBet({
  userId,
  guildId,
  totalBet,
  betId,
  game
}: {
  userId: string
  guildId: string
  totalBet: number
  betId: string
  game: CasinoGameId
}) {
  const session = await mongoose.startSession()

  try {
    await session.withTransaction(async () => {
      const duplicateBet = await Transaction.exists({
        betId,
        type: 'bet'
      }).session(session)
      if (duplicateBet) throw new Error('DUPLICATE_BET')

      const user = await User.findOne({ userId, guildId }).session(session)
      if (!user) throw new Error('USER_NOT_FOUND')

      const bonusUsed = Math.min(user.bonusBalance ?? 0, totalBet)
      const cashUsed = totalBet - bonusUsed

      if (user.balance < cashUsed) {
        throw new Error('INSUFFICIENT_FUNDS')
      }

      try {
        await Transaction.create(
          [
            {
              userId,
              guildId,
              amount: totalBet,
              type: 'bet',
              source: 'casino',
              betId,
              meta: { game }
            }
          ],
          { session }
        )
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          'code' in err &&
          (err as { code: number }).code === 11000
        ) {
          throw new Error('DUPLICATE_BET')
        }

        throw err
      }

      user.bonusBalance -= bonusUsed
      user.balance -= cashUsed
      user.lockedBalance += totalBet

      await user.save({ session })
    })
  } finally {
    session.endSession()
  }
}

export async function settleRpsGameAtomic({
  p1UserId,
  p1GuildId,
  p2UserId,
  p2GuildId,
  betAmount,
  winnerUserId,
  casinoCut,
  betId,
  game
}: {
  p1UserId: string
  p1GuildId: string
  p2UserId: string
  p2GuildId: string
  betAmount: number
  winnerUserId: string | null
  casinoCut: number
  betId: string
  game: CasinoGameId
}) {
  const session = await mongoose.startSession()

  try {
    await session.withTransaction(async () => {
      const alreadySettled = await Transaction.findOne({
        betId,
        type: 'win'
      }).session(session)

      if (alreadySettled) return

      const [p1, p2] = await Promise.all([
        User.findOne({ userId: p1UserId, guildId: p1GuildId }).session(session),
        User.findOne({ userId: p2UserId, guildId: p2GuildId }).session(session)
      ])

      if (!p1 || !p2) throw new Error('USER_NOT_FOUND')

      if (p1.lockedBalance < betAmount || p2.lockedBalance < betAmount) return
      p1.lockedBalance -= betAmount
      p2.lockedBalance -= betAmount

      if (winnerUserId === null) {
        p1.balance += betAmount
        p2.balance += betAmount
      } else {
        const pot = betAmount * 2
        const payout = pot * (1 - casinoCut)

        const winner = winnerUserId === p1.userId ? p1 : p2
        winner.balance += payout

        await Transaction.create(
          [
            {
              userId: winner.userId,
              guildId: winner.guildId,
              amount: payout,
              type: 'win',
              source: 'casino',
              betId,
              meta: { game }
            }
          ],
          { session }
        )
      }

      await Promise.all([p1.save({ session }), p2.save({ session })])
    })
  } finally {
    session.endSession()
  }
}

export async function spendCasinoBalance({
  userId,
  guildId,
  amount,
  betId,
  game
}: {
  userId: string
  guildId: string
  amount: number
  betId: string
  game: CasinoGameId
}) {
  const session = await mongoose.startSession()

  try {
    await session.withTransaction(async () => {
      const duplicateBet = await Transaction.exists({
        betId,
        type: 'bet'
      }).session(session)
      if (duplicateBet) throw new Error('DUPLICATE_BET')

      const user = await User.findOne({ userId, guildId }).session(session)
      if (!user) throw new Error('USER_NOT_FOUND')

      const bonusBalance = user.bonusBalance ?? 0
      const bonusUsed = Math.min(bonusBalance, amount)
      const cashUsed = amount - bonusUsed

      const balanceInc: Record<string, number> = { balance: -cashUsed }
      if (bonusUsed > 0) balanceInc.bonusBalance = -bonusUsed

      const result = await User.updateOne(
        {
          userId,
          guildId,
          balance: { $gte: cashUsed }
        },
        { $inc: balanceInc },
        { session }
      )

      if (result.modifiedCount === 0) {
        throw new Error('INSUFFICIENT_FUNDS')
      }

      try {
        await Transaction.create(
          [
            {
              userId,
              guildId,
              amount,
              type: 'bet',
              source: 'casino',
              betId,
              meta: { game }
            }
          ],
          { session }
        )
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          'code' in err &&
          (err as { code: number }).code === 11000
        ) {
          throw new Error('DUPLICATE_BET')
        }

        throw err
      }
    })
  } finally {
    session.endSession()
  }
}
