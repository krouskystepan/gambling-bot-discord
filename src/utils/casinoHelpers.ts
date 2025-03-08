import { GOLDEN_JACKPOT_ONE_IN_CHANCE, WEIGHTED_SYMBOLS } from './casinoConfig'

export function spinSlot() {
  return (
    WEIGHTED_SYMBOLS[Math.floor(Math.random() * WEIGHTED_SYMBOLS.length)] +
    WEIGHTED_SYMBOLS[Math.floor(Math.random() * WEIGHTED_SYMBOLS.length)] +
    WEIGHTED_SYMBOLS[Math.floor(Math.random() * WEIGHTED_SYMBOLS.length)]
  )
}

export function rollDice() {
  return Math.floor(Math.random() * 6) + 1
}

export function flipCoin() {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

export function drawLottery() {
  return Array.from({ length: 50 }, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
}

export function drawGoldenJackpot() {
  return Math.floor(Math.random() * GOLDEN_JACKPOT_ONE_IN_CHANCE) + 1
}
