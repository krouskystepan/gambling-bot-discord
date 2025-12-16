import {
  LOTTERY_NUM_TO_DRAW,
  LOTTERY_TOTAL_NUMBERS,
  MINI_NUMBERS
} from 'gambling-bot-shared'

import { Card } from './blackjackUtils'

export const spinSlot = (slotConfig: {
  symbolWeights: Record<string, number>
}): string => {
  const weightedSymbols = Object.entries(slotConfig.symbolWeights).flatMap(
    ([symbol, weight]) => Array(Number(weight)).fill(symbol)
  )
  const spin = () =>
    weightedSymbols[Math.floor(Math.random() * weightedSymbols.length)]

  return spin() + spin() + spin()
}

export const rollDice = () => {
  return Math.floor(Math.random() * 6) + 1
}

export const flipCoin = () => {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

export const drawLottery = () => {
  const pool = Array.from({ length: LOTTERY_TOTAL_NUMBERS }, (_, i) => i + 1)
  const result: number[] = []

  for (let i = 0; i < LOTTERY_NUM_TO_DRAW; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    result.push(pool[idx])
    pool.splice(idx, 1)
  }

  return result
}

export const drawGoldenJackpot = (goldenJackpotConfig: {
  oneInChance: number
}) => {
  return Math.floor(Math.random() * goldenJackpotConfig.oneInChance) + 1
}

export const spinRouletteWheel = (): string => {
  const keys = Object.keys(MINI_NUMBERS)
  const index = Math.floor(Math.random() * keys.length)
  return keys[index]
}

export const drawNextCard = (deck: Card[], cardIndex: number): Card => {
  if (cardIndex >= deck.length) {
    cardIndex = 0
  }

  return deck[cardIndex]
}
