import crypto from 'crypto'
import {
  LOTTERY_NUM_TO_DRAW,
  LOTTERY_TOTAL_NUMBERS,
  MINI_NUMBERS,
  TCasinoSettings
} from 'gambling-bot-shared'

import { Card } from './blackjack'

const random = () => {
  return crypto.randomInt(0, 1_000_000) / 1_000_000
}

export const spinSlot = (slotConfig: {
  symbolWeights: TCasinoSettings['slots']['symbolWeights']
}): keyof TCasinoSettings['slots']['winMultipliers'] => {
  const weightedSymbols = Object.entries(slotConfig.symbolWeights).flatMap(
    ([symbol, weight]) => Array(Number(weight)).fill(symbol)
  )
  const spin = () =>
    weightedSymbols[Math.floor(random() * weightedSymbols.length)]

  return spin() + spin() + spin()
}

export const rollDice = () => {
  return Math.floor(random() * 6) + 1
}

export const flipCoin = () => {
  return random() < 0.5 ? 'heads' : 'tails'
}

export const drawLottery = () => {
  const pool = Array.from({ length: LOTTERY_TOTAL_NUMBERS }, (_, i) => i + 1)
  const result: number[] = []

  for (let i = 0; i < LOTTERY_NUM_TO_DRAW; i++) {
    const idx = Math.floor(random() * pool.length)
    result.push(pool[idx])
    pool.splice(idx, 1)
  }

  return result
}

export const drawGoldenJackpot = (goldenJackpotConfig: {
  oneInChance: number
}) => {
  return Math.floor(random() * goldenJackpotConfig.oneInChance) + 1
}

export const spinRouletteWheel = (): string => {
  const keys = Object.keys(MINI_NUMBERS)
  const index = Math.floor(random() * keys.length)
  return keys[index]
}

export const drawNextCard = (deck: Card[], cardIndex: number): Card => {
  if (cardIndex >= deck.length) {
    cardIndex = 0
  }

  return deck[cardIndex]
}

export const dropPlinkoBall = (rows: number, bias = 0.5): number => {
  let rights = 0
  for (let i = 0; i < rows; i++) {
    if (random() < bias) rights++
  }
  return rights // bin index
}
