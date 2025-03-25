// Dice
export const DICE_MAX_SIMULATE_ROLLS = 100_000_000
export const DICE_WIN_MULTIPLIER = 5
export const DICE_MAX_BET = 0 // 3000

// Coin Flip
export const COINFLIP_MAX_SIMULATE_FLIPS = 200_000_000
export const COINFLIP_WIN_MULTIPLIER = 1.9
export const COINFLIP_MAX_BET = 0 // 3000

// Slots
export const SLOT_MAX_SIMULATE_SPINS = 50_000_000
export const SLOT_MULTIPLIERS = {
  '🍒🍒🍒': 5,
  '🍋🍋🍋': 10,
  '🍉🍉🍉': 20,
  '🔔🔔🔔': 50,
  '7️⃣7️⃣7️⃣': 100,
}
export const SYMBOL_WEIGHTS = {
  '🍒': 35,
  '🍋': 25,
  '🍉': 10,
  '🔔': 4,
  '7️⃣': 2,
}
export const WEIGHTED_SYMBOLS = Object.entries(SYMBOL_WEIGHTS).flatMap(
  ([symbol, weight]) => Array(weight).fill(symbol)
)
export const SLOT_MAX_BET = 0 // 1000

// Lottery
export const LOTTERY_MAX_SIMULATE_ENTRIES = 500_000
export const LOTTERY_MAX_BET = 0 // 1000
export const LOTTERY_MULTIPLIERS = {
  5: 1000,
  4: 125,
  3: 25,
  2: 4,
  1: 0,
  0: 0,
}

// Rock, Paper, Scissors
export const RPS_CASINO_CUT = 0.025
export const RPS_MAX_BET = 0 // 10000

// Golden Jackpot
export const GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES = 100_000_000
export const GOLDEN_JACKPOT_MAX_BET = 0 // 1000
export const GOLDEN_JACKPOT_MULTIPLIER = 10_000
export const GOLDEN_JACKPOT_ONE_IN_CHANCE = 12_000

// Blackjack
export const BLACKJACK_MAX_BET = 0 // 1000
