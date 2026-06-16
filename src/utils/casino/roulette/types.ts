import { defaultCasinoSettings } from 'gambling-bot-shared/casino'

export type RouletteBetType =
  keyof (typeof defaultCasinoSettings)['roulette']['winMultipliers']

export type RouletteBet = {
  type: RouletteBetType
  value: string
  amount: number
  displayValue: string
}

export type RouletteWinMultipliers =
  (typeof defaultCasinoSettings)['roulette']['winMultipliers']
