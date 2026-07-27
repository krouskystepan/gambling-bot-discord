import type { TRouletteSlipBet } from 'gambling-bot-shared/roulette'

import { inferTypeFromValue } from './infer'
import type { RouletteBet } from './types'

export const buildSlipBet = (
  rawTarget: string,
  amount: number
): TRouletteSlipBet => {
  const type = inferTypeFromValue(rawTarget)
  let value = rawTarget
  const displayValue = rawTarget

  if (type === 'dozen' || type === 'column') {
    value = rawTarget[1]
  }

  return { amount, type, value, displayValue }
}

export const mergeSlipBet = (
  bets: TRouletteSlipBet[],
  next: TRouletteSlipBet
): TRouletteSlipBet[] => {
  const index = bets.findIndex(
    (bet) => bet.type === next.type && bet.value === next.value
  )

  if (index === -1) return [...bets, next]

  const copy = [...bets]
  copy[index] = {
    ...copy[index],
    amount: copy[index].amount + next.amount
  }
  return copy
}

export const toRouletteBets = (bets: TRouletteSlipBet[]): RouletteBet[] =>
  bets.map((bet) => ({
    amount: bet.amount,
    type: bet.type,
    value: bet.value,
    displayValue: bet.displayValue
  }))
