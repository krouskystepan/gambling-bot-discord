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
      $inc: { balance: reward, lockedBalance: reward },
      $set: { lastDailyClaim: now, dailyStreak: streak }
    },
    { new: true }
  ).lean()
}
