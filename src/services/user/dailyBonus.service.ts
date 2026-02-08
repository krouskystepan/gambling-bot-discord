import { TUser } from 'gambling-bot-shared'

import User from '@/models/User'

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
    { new: true }
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
    { new: true }
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
