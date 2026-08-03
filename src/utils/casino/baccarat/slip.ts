import type {
  BaccaratBetSide,
  BaccaratSlipBet
} from 'gambling-bot-shared/casino'
import { BACCARAT_BET_SIDES } from 'gambling-bot-shared/casino'

export const BACCARAT_MAX_SLIP_BETS = BACCARAT_BET_SIDES.length

export const slipTotal = (bets: readonly BaccaratSlipBet[]) =>
  bets.reduce((sum, bet) => sum + bet.amount, 0)

export const buildSlipBet = (
  side: BaccaratBetSide,
  amount: number
): BaccaratSlipBet => ({ side, amount })

export const mergeSlipBet = (
  bets: BaccaratSlipBet[],
  next: BaccaratSlipBet
): BaccaratSlipBet[] => {
  const index = bets.findIndex((bet) => bet.side === next.side)

  if (index === -1) {
    return [...bets, { side: next.side, amount: next.amount }]
  }

  const copy = [...bets]
  const existing = copy[index]!
  // Copy fields explicitly: mongoose subdocs do not spread with `...existing`.
  copy[index] = {
    side: existing.side,
    amount: existing.amount + next.amount
  }
  return copy
}

/** Prefer lockedAmount; fall back to summing the reserved slip. */
export const baccaratLockedTotal = ({
  lockedAmount,
  bets
}: {
  lockedAmount?: number | null
  bets?: readonly BaccaratSlipBet[] | null
}) => {
  if (lockedAmount != null && lockedAmount > 0) return lockedAmount
  if (!bets?.length) return 0
  return slipTotal(bets)
}
