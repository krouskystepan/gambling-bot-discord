const DAY_MS = 24 * 60 * 60 * 1000

export const canClaimDailyBonus = (
  lastClaim: Date | null,
  now: Date
): boolean => {
  if (!lastClaim) return true
  return now.getTime() - lastClaim.getTime() >= DAY_MS
}

export const getStreakAfterClaim = (
  lastClaim: Date | null,
  now: Date,
  currentStreak: number
): number => {
  if (!lastClaim) return 1
  if (now.getTime() - lastClaim.getTime() < 2 * DAY_MS) {
    return currentStreak + 1
  }
  return 1
}

export const getStreakDisplay = (
  lastClaim: Date | null,
  now: Date,
  streak: number
): { currentStreak: number; nextStreak: number } => {
  if (!lastClaim) {
    return { currentStreak: 0, nextStreak: 1 }
  }

  const diff = now.getTime() - lastClaim.getTime()
  if (diff < 2 * DAY_MS) {
    return { currentStreak: streak, nextStreak: streak + 1 }
  }

  return { currentStreak: 0, nextStreak: 1 }
}
