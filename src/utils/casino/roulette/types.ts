import { defaultCasinoSettings } from 'gambling-bot-shared'

export type RouletteBetType =
  keyof (typeof defaultCasinoSettings)['roulette']['winMultipliers']

export type RouletteBet = {
  type: RouletteBetType
  value: string
  amount: number
  displayValue: string
}
