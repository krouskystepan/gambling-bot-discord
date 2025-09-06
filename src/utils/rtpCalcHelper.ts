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
  const toNumber = (val: unknown): number => {
    if (typeof val === 'string') return parseFloat(val) || 0
    if (typeof val === 'number') return val
    return 0
  }

  switch (game) {
    case 'dice': {
      const { winMultiplier } = settings as CasinoSettings['dice']
      return (1 / 6) * toNumber(winMultiplier) * 100
    }

    case 'coinflip': {
      const { winMultiplier } = settings as CasinoSettings['coinflip']
      return 0.5 * toNumber(winMultiplier) * 100
    }

    case 'slots': {
      const { symbolWeights, winMultipliers } =
        settings as CasinoSettings['slots']

      const totalWeight = Object.values(symbolWeights).reduce(
        (a, b) => a + toNumber(b),
        0
      )

      let rtp = 0
      for (const [symbol, weight] of Object.entries(symbolWeights)) {
        const probability = Math.pow(toNumber(weight) / totalWeight, 3)
        const combo = symbol + symbol + symbol
        const multiplier = toNumber(winMultipliers[combo] ?? 0)
        rtp += probability * multiplier
      }

      return rtp * 100
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
        const multiplier = toNumber(winMultipliers[k] ?? 0)
        rtp += probability * multiplier
      }

      return rtp * 100
    }

    case 'rps': {
      const { casinoCut } = settings as CasinoSettings['rps']
      return (1 - toNumber(casinoCut)) * 100
    }

    case 'goldenJackpot': {
      const { winMultiplier, oneInChance } =
        settings as CasinoSettings['goldenJackpot']
      return (toNumber(winMultiplier) / toNumber(oneInChance)) * 100
    }

    case 'blackjack':
      return 99.4

    case 'prediction':
      return 0

    default:
      console.warn(`RTP for ${game} not implemented`)
      return 0
  }
}
