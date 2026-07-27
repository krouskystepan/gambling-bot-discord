import { getMinesPayoutMultiplier } from 'gambling-bot-shared/mines'

/** Rough mock payout: ~45% cash-out after 1–3 safe reveals. */
export function simulateMinesWinnings(
  betAmount: number,
  houseEdge = 0.03
): number {
  if (Math.random() >= 0.45) return 0

  const mineCount = Math.floor(Math.random() * 5) + 1
  const safeReveals = Math.floor(Math.random() * 3) + 1
  const multiplier = getMinesPayoutMultiplier(mineCount, safeReveals, houseEdge)
  return betAmount * multiplier
}
