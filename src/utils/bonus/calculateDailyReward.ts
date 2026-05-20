export type DailyBonusSettings = {
  rewardMode?: string
  baseReward?: number
  streakIncrement?: number
  streakMultiplier?: number
  maxReward?: number
  resetOnMax?: boolean
  milestoneBonus?: {
    weekly?: number
    monthly?: number
  }
}

export const calculateDailyReward = (
  streakNum: number,
  settings: DailyBonusSettings
): number => {
  const {
    rewardMode = 'linear',
    baseReward = 0,
    streakIncrement = 0,
    streakMultiplier = 1,
    maxReward = 0,
    resetOnMax = false,
    milestoneBonus: {
      weekly: milestoneWeekly = 0,
      monthly: milestoneMonthly = 0
    } = {}
  } = settings

  let reward = Number(baseReward)

  if (rewardMode === 'linear') {
    reward += (streakNum - 1) * Number(streakIncrement)
  } else {
    reward *= Math.pow(Number(streakMultiplier), streakNum - 1)
  }

  if (maxReward > 0 && reward > maxReward) {
    if (resetOnMax) {
      if (rewardMode === 'linear') {
        const cycleLength =
          Math.floor((maxReward - baseReward) / streakIncrement) + 1
        const newStreak = ((streakNum - 1) % cycleLength) + 1
        reward = baseReward + (newStreak - 1) * streakIncrement
      } else {
        const cycleLength =
          Math.floor(
            Math.log(maxReward / baseReward) / Math.log(streakMultiplier)
          ) + 1
        const newStreak = ((streakNum - 1) % cycleLength) + 1
        reward = baseReward * Math.pow(streakMultiplier, newStreak - 1)
      }
    } else {
      reward = maxReward
    }
  }

  if (streakNum % 7 === 0) reward += Number(milestoneWeekly)
  if (streakNum % 28 === 0) reward += Number(milestoneMonthly)

  return reward
}
