export const DICE_MAX_SIMULATE_ROLLS = 100_000_000
export const COINFLIP_MAX_SIMULATE_FLIPS = 200_000_000
export const SLOT_MAX_SIMULATE_SPINS = 50_000_000
export const LOTTERY_MAX_SIMULATE_ENTRIES = 500_000
export const GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES = 100_000_000

export const readableGameValueNames = [
  { name: 'Maximum Bet Amount', value: 'maxBet' },
  { name: 'Minimum Bet Amount', value: 'minBet' },
  { name: 'Win Multiplier (x)', value: 'winMultiplier' },
  { name: 'Win Multipliers (x)', value: 'winMultipliers' },
  { name: 'Casino House Cut (%)', value: 'casinoCut' },
  { name: 'One-In Chance (e.g. 1 in 10,000)', value: 'oneInChance' },
  { name: 'Symbol Weights', value: 'symbolWeights' },
]

const defaultCasinoSettings = {
  dice: {
    winMultiplier: 5,
    maxBet: 0,
    minBet: 0,
  },
  coinflip: {
    winMultiplier: 1.9,
    maxBet: 0,
    minBet: 0,
  },
  slots: {
    winMultipliers: {
      '🍒🍒🍒': 5,
      '🍋🍋🍋': 10,
      '🍉🍉🍉': 20,
      '🔔🔔🔔': 50,
      '7️⃣7️⃣7️⃣': 100,
    },
    symbolWeights: {
      '🍒': 35,
      '🍋': 25,
      '🍉': 10,
      '🔔': 4,
      '7️⃣': 2,
    },
    maxBet: 0,
    minBet: 0,
  },
  lottery: {
    winMultipliers: {
      5: 1000,
      4: 125,
      3: 25,
      2: 4,
      1: 0,
      0: 0,
    },
    maxBet: 0,
    minBet: 0,
  },
  rps: {
    casinoCut: 0.025,
    maxBet: 0,
    minBet: 0,
  },
  goldenJackpot: {
    winMultiplier: 10_000,
    oneInChance: 12_000,
    maxBet: 0,
    minBet: 0,
  },
  blackjack: {
    maxBet: 0,
    minBet: 0,
  },
}

export default defaultCasinoSettings
