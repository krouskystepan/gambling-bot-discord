import {
  type BonusSettings,
  TUser,
  calculateBonusReward,
  getStreakAfterClaim
} from 'gambling-bot-shared'
import mongoose from 'mongoose'

import Transaction from '@/models/Transaction'
import User from '@/models/User'

export type ClaimDailyBonusResult =
  | {
      ok: true
      user: TUser
      reward: number
      streak: number
      isReset: boolean
    }
  | { ok: false; reason: 'ALREADY_CLAIMED' | 'USER_NOT_FOUND' }

export const claimDailyBonusAtomic = async ({
  userId,
  guildId,
  now,
  settings
}: {
  userId: string
  guildId: string
  now: Date
  settings: BonusSettings
}): Promise<ClaimDailyBonusResult> => {
  const session = await mongoose.startSession()

  try {
    let result: ClaimDailyBonusResult = {
      ok: false,
      reason: 'ALREADY_CLAIMED'
    }

    await session.withTransaction(async () => {
      const user = await User.findOne({ userId, guildId }).session(session)
      if (!user) {
        result = { ok: false, reason: 'USER_NOT_FOUND' }
        return
      }

      const lastClaim = user.lastDailyClaim
        ? new Date(user.lastDailyClaim)
        : null

      const canClaim =
        !lastClaim || now.getTime() - lastClaim.getTime() >= 24 * 60 * 60 * 1000

      if (!canClaim) return

      const streak = getStreakAfterClaim(lastClaim, now, user.dailyStreak ?? 0)
      const { reward, isReset } = calculateBonusReward({ streak, settings })

      const updated = await User.findOneAndUpdate(
        {
          userId,
          guildId,
          $or: [
            {
              lastDailyClaim: {
                $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
              }
            },
            { lastDailyClaim: null }
          ]
        },
        {
          $inc: { bonusBalance: reward },
          $set: { lastDailyClaim: now, dailyStreak: streak }
        },
        { returnDocument: 'after', session }
      ).lean()

      if (!updated) return

      await Transaction.create(
        [
          {
            userId,
            guildId,
            amount: reward,
            type: 'bonus',
            source: 'system',
            meta: { bonusStreak: streak }
          }
        ],
        { session }
      )

      result = {
        ok: true,
        user: updated as TUser,
        reward,
        streak,
        isReset
      }
    })

    return result
  } finally {
    session.endSession()
  }
}

export const claimDailyBonus = async ({
  user,
  reward,
  streak,
  now
}: {
  user: TUser
  reward: number
  streak: number
  now: Date
}): Promise<TUser | null> => {
  return User.findOneAndUpdate(
    {
      userId: user.userId,
      guildId: user.guildId,
      $or: [
        {
          lastDailyClaim: {
            $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
          }
        },
        { lastDailyClaim: null }
      ]
    },
    {
      $inc: { bonusBalance: reward },
      $set: { lastDailyClaim: now, dailyStreak: streak }
    },
    { returnDocument: 'after' }
  ).lean()
}

export const addUserBonus = async ({
  userId,
  guildId,
  amount
}: {
  userId: string
  guildId: string
  amount: number
}) => {
  return User.findOneAndUpdate(
    { userId, guildId },
    { $inc: { bonusBalance: amount } },
    { returnDocument: 'after' }
  )
}

export const removeUserBonus = async ({
  userId,
  guildId,
  amount
}: {
  userId: string
  guildId: string
  amount: number
}) => {
  const user = await User.findOne({ userId, guildId })
  if (!user) return null

  const currentBonus = user.bonusBalance ?? 0
  if (currentBonus <= 0) return null

  const toRemove = Math.min(currentBonus, amount)

  user.bonusBalance = currentBonus - toRemove
  await user.save()

  return {
    user,
    removed: toRemove
  }
}
