import type {
  RouletteBetType,
  RouletteWinMultipliers,
  RouletteBet as SharedRouletteBet
} from 'gambling-bot-shared/casino'

export type { RouletteBetType, RouletteWinMultipliers }

export type RouletteBet = SharedRouletteBet & {
  displayValue: string
}
