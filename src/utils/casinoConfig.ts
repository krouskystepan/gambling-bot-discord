// Dice
export const MAX_SIMULATE_ROLLS = 100_000_0000
export const DICE_WIN_MULTIPLIER = 5
export const DICE_MAX_BET = 3000

// Coin Flip
export const MAX_SIMULATE_FLIPS = 200_000_000
export const COINFLIP_WIN_MULTIPLIER = 1.9
export const COINFLIP_MAX_BET = 3000

// Slots
export const MAX_SIMULATE_SPINS = 50_000_000
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
export const SLOT_MAX_BET = 1000

// Lottery
export const MAX_SIMULATE_LOTTERY = 10_000_000
export const LOTTERY_MAX_BET = 1000
export const getLotteryMultiplier = (matchedNumbers: number): number => {
  let multiplier: number
  switch (matchedNumbers) {
    case 5:
      multiplier = 1000
      break
    case 4:
      multiplier = 125
      break
    case 3:
      multiplier = 25
      break
    case 2:
      multiplier = 4
      break
    default:
      multiplier = 0
  }
  return multiplier
}

// Rock, Paper, Scissors
export const RPS_CASINO_CUT = 0.025
