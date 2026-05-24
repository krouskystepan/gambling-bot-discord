import { MINI_NUMBERS } from 'gambling-bot-shared'

import type { RouletteBet, RouletteWinMultipliers } from './types'

export function calculateRouletteWin(
  bet: RouletteBet,
  result: string,
  payouts: RouletteWinMultipliers
) {
  const amount = bet.amount
  const numResult = Number(result)

  switch (bet.type) {
    case 'number':
      return bet.value === result ? amount * payouts.number : 0

    case 'color':
      if (result === '0') return 0
      return MINI_NUMBERS[result] === bet.value.toLowerCase()
        ? amount * payouts.color
        : 0

    case 'parity':
      if (result === '0') return 0
      const isEven = numResult % 2 === 0
      return bet.value.toLowerCase() === (isEven ? 'even' : 'odd')
        ? amount * payouts.parity
        : 0

    case 'range':
      if (result === '0') return 0
      const isLow = numResult >= 1 && numResult <= 9
      return bet.value.toLowerCase() === (isLow ? 'low' : 'high')
        ? amount * payouts.range
        : 0

    case 'dozen':
      if (result === '0') return 0
      const dozen = Math.ceil(Number(result) / 6)
      return Number(bet.value) === dozen ? amount * payouts.dozen : 0

    case 'column':
      if (result === '0') return 0
      const col = ((Number(result) - 1) % 3) + 1
      return Number(bet.value) === col ? amount * payouts.column : 0
  }
}
