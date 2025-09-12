import defaultCasinoSettings from './defaultConfig'

export type RouletteBetType =
  keyof (typeof defaultCasinoSettings)['roulette']['winMultipliers']

export interface RouletteBet {
  type: RouletteBetType
  value: string
  amount: number
}

export const MINI_NUMBERS: Record<string, 'red' | 'black' | 'green'> = {
  '0': 'green',
  '1': 'red',
  '3': 'red',
  '5': 'red',
  '7': 'red',
  '9': 'red',
  '12': 'red',
  '14': 'red',
  '16': 'red',
  '18': 'red',
  '2': 'black',
  '4': 'black',
  '6': 'black',
  '8': 'black',
  '10': 'black',
  '11': 'black',
  '13': 'black',
  '15': 'black',
  '17': 'black',
}

export function inferTypeFromValue(value: string): RouletteBetType {
  const val = value.toLowerCase()

  if (['red', 'black'].includes(val)) return 'color'
  if (['even', 'odd'].includes(val)) return 'parity'
  if (['low', 'high'].includes(val)) return 'range'
  if (val.startsWith('d') && ['1', '2', '3'].includes(val[1])) return 'dozen'
  if (val.startsWith('c') && ['1', '2', '3'].includes(val[1])) return 'column'
  if (val in MINI_NUMBERS) return 'number'

  throw new Error(`Invalid bet value: ${value}`)
}

export function calculateRouletteWin(
  bet: RouletteBet,
  result: string,
  payouts: (typeof defaultCasinoSettings)['roulette']['winMultipliers']
) {
  const amount = bet.amount
  if (result === '0') return 0

  switch (bet.type) {
    case 'number':
      return bet.value === result ? amount * payouts.number : 0
    case 'color':
      return MINI_NUMBERS[result] === bet.value.toLowerCase()
        ? amount * payouts.color
        : 0
    case 'parity':
      const isEven = Number(result) % 2 === 0
      return bet.value.toLowerCase() === (isEven ? 'even' : 'odd')
        ? amount * payouts.parity
        : 0
    case 'range':
      const isLow = Number(result) <= 9
      return bet.value.toLowerCase() === (isLow ? 'low' : 'high')
        ? amount * payouts.range
        : 0
    case 'dozen':
      const dozen = Math.ceil(Number(result) / 6)
      return Number(bet.value) === dozen ? amount * payouts.dozen : 0
    case 'column':
      const col = ((Number(result) - 1) % 3) + 1
      return Number(bet.value) === col ? amount * payouts.column : 0
  }
}

export function getRouletteColor(number: string) {
  const color = MINI_NUMBERS[number]
  if (color === 'green') return '🟢'
  if (color === 'red') return '🔴'
  if (color === 'black') return '⚫'
  return '❓ Unknown'
}
