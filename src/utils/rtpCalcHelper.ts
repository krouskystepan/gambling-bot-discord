import defaultCasinoSettings, {
  LOTTERY_NUM_TO_DRAW,
  LOTTERY_TOTAL_NUMBERS,
} from './defaultConfig'

// helper na kombinace
const combination = (n: number, k: number): number => {
  if (k > n) return 0
  let result = 1
  for (let i = 1; i <= k; i++) {
    result = (result * (n - i + 1)) / i
  }
  return result
}

type CasinoSettings = typeof defaultCasinoSettings

export const calculateRTP = (
  game: keyof CasinoSettings,
  settings: CasinoSettings[typeof game]
): number => {
  switch (game) {
    case 'dice': {
      const winChance = 1 / 6
      return winChance * (settings as CasinoSettings['dice']).winMultiplier
    }

    case 'coinflip': {
      const winChance = 0.5
      return winChance * (settings as CasinoSettings['coinflip']).winMultiplier
    }

    case 'slots': {
      const { symbolWeights, winMultipliers } =
        settings as CasinoSettings['slots']

      const totalWeight = Object.values(symbolWeights).reduce(
        (a, b) => a + b,
        0
      )

      let rtp = 0
      for (const [symbol, weight] of Object.entries(symbolWeights)) {
        const probability = Math.pow(weight / totalWeight, 3)
        const combo = symbol + symbol + symbol
        const multiplier = winMultipliers[combo] ?? 0
        rtp += probability * multiplier
      }

      return rtp
    }

    case 'lottery': {
      const { winMultipliers } = settings as CasinoSettings['lottery']

      const userPicks = LOTTERY_NUM_TO_DRAW
      const drawnNumbers = LOTTERY_NUM_TO_DRAW

      let rtp = 0

      for (let k = 0; k <= userPicks; k++) {
        const favorable =
          combination(userPicks, k) *
          combination(LOTTERY_TOTAL_NUMBERS - userPicks, drawnNumbers - k)
        const probability =
          favorable / combination(LOTTERY_TOTAL_NUMBERS, drawnNumbers)
        const multiplier = winMultipliers[k] ?? 0
        rtp += probability * multiplier
      }

      return rtp
    }

    case 'rps': {
      const { casinoCut } = settings as CasinoSettings['rps']
      return 1 - casinoCut
    }

    case 'goldenJackpot': {
      const { winMultiplier, oneInChance } =
        settings as CasinoSettings['goldenJackpot']
      return (1 / oneInChance) * winMultiplier
    }

    case 'blackjack': {
      // Blackjack RTP depends on strategy and rules.
      // In an infinite deck model, without splits and with basic strategy:
      // ~99.3–99.5%. We return 0.994 as the average.
      return 0.994
    }

    default:
      throw new Error(`RTP for ${game} not implemented`)
  }
}
