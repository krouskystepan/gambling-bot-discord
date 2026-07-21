import crypto from 'crypto'
import {
  LOTTERY_NUM_TO_DRAW,
  LOTTERY_TOTAL_NUMBERS,
  MINI_NUMBERS,
  SUITES,
  TCasinoSettings,
  VALUES,
  hiloRankFromLabel
} from 'gambling-bot-shared/casino'

import type { Card } from './blackjack/types'
import { buildPlinkoPath } from './plinko/path'

const random = () => {
  return crypto.randomInt(0, 1_000_000) / 1_000_000
}

export type HiloCard = {
  label: string
  suite: (typeof SUITES)[number]
  rank: number
}

/** Same display as blackjack: `K♠️`. */
export const formatHiloCard = (card: Pick<HiloCard, 'label' | 'suite'>) =>
  `${card.label}${card.suite}`

const buildHiloDeck = (): HiloCard[] =>
  SUITES.flatMap((suite) =>
    VALUES.map(({ label }) => ({
      label,
      suite,
      rank: hiloRankFromLabel(label)
    }))
  )

/** Fisher–Yates shuffle of a Hi-Lo deck. */
export const shuffleHiloDeck = (deck: HiloCard[]): HiloCard[] => {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/** Fresh shuffled 52-card deck (one of each label+suit). */
export const createShuffledHiloDeck = (): HiloCard[] =>
  shuffleHiloDeck(buildHiloDeck())

/** Draw from the end of a mutable deck (no replacement). */
export const drawHiloCard = (deck: HiloCard[]): HiloCard => {
  const card = deck.pop()
  if (!card) throw new Error('Hi-Lo deck is empty')
  return card
}

/** Two distinct cards from one shuffled deck. */
export const dealHiloCards = (): { first: HiloCard; second: HiloCard } => {
  const deck = createShuffledHiloDeck()
  return { first: drawHiloCard(deck), second: drawHiloCard(deck) }
}

export const rollHiloCard = (): HiloCard =>
  drawHiloCard(createShuffledHiloDeck())

export const rollHiloRank = (): number => rollHiloCard().rank

export const rollHiloRanks = (): { first: number; second: number } => {
  const { first, second } = dealHiloCards()
  return { first: first.rank, second: second.rank }
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

export const shuffleDeck = (deck: Card[]): Card[] => {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Full plinko path for animation; final bin = last element. */
export const dropPlinkoPath = (rows: number, bias = 0.5): number[] =>
  buildPlinkoPath(rows, () => random() < bias)

/** Plinko landing bin index (0..rows). */
export const dropPlinkoBall = (rows: number, bias = 0.5): number => {
  const path = dropPlinkoPath(rows, bias)
  return path[path.length - 1]!
}
