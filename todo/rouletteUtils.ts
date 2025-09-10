export type RouletteBetType =
  | 'number'
  | 'color'
  | 'parity'
  | 'range'
  | 'dozen'
  | 'column'

export interface RouletteBet {
  type: RouletteBetType
  value: string
}

export const AMERICAN_NUMBERS = [
  '0',
  '00',
  ...Array.from({ length: 36 }, (_, i) => (i + 1).toString()),
]
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])
const BLACK_NUMBERS = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
])

const PAYOUTS: Record<RouletteBetType, number> = {
  number: 35,
  color: 1,
  parity: 1,
  range: 1,
  dozen: 2,
  column: 2,
}

export function calculateRouletteWin(
  bet: RouletteBet,
  result: string,
  amount: number
) {
  switch (bet.type) {
    case 'number':
      return bet.value === result ? amount * PAYOUTS.number : 0
    case 'color':
      if (result === '0' || result === '00') return 0
      const num = Number(result)
      if (RED_NUMBERS.has(num) && bet.value.toLowerCase() === 'red')
        return amount * PAYOUTS.color
      if (BLACK_NUMBERS.has(num) && bet.value.toLowerCase() === 'black')
        return amount * PAYOUTS.color
      return 0
    case 'parity':
      if (result === '0' || result === '00') return 0
      const isEven = Number(result) % 2 === 0
      return bet.value.toLowerCase() === (isEven ? 'even' : 'odd')
        ? amount * PAYOUTS.parity
        : 0
    case 'range':
      if (result === '0' || result === '00') return 0
      const isLow = Number(result) <= 18
      return bet.value.toLowerCase() === (isLow ? 'low' : 'high')
        ? amount * PAYOUTS.range
        : 0
    case 'dozen':
      if (result === '0' || result === '00') return 0
      const dozen = Math.ceil(Number(result) / 12)
      return Number(bet.value) === dozen ? amount * PAYOUTS.dozen : 0
    case 'column':
      if (result === '0' || result === '00') return 0
      const col = ((Number(result) - 1) % 3) + 1
      return Number(bet.value) === col ? amount * PAYOUTS.column : 0
  }
}

export function getRouletteColor(number: string): string {
  if (number === '0' || number === '00') return '🟢'

  const num = parseInt(number, 10)
  if (RED_NUMBERS.has(num)) return '🔴'
  if (BLACK_NUMBERS.has(num)) return '⚫'

  return '❓ Unknown'
}
