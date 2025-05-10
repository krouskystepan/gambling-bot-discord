export const DICE_MAX_SIMULATE_ROLLS = 100_000_000
export const COINFLIP_MAX_SIMULATE_FLIPS = 200_000_000
export const SLOT_MAX_SIMULATE_SPINS = 50_000_000
export const LOTTERY_MAX_SIMULATE_ENTRIES = 500_000
export const GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES = 100_000_000

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
  slot: {
    winMultiplier: {
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
    winMultiplier: {
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
