import crypto from 'crypto'

import { defaultCasinoSettings, LOTTERY_NUM_TO_DRAW } from 'gambling-bot-shared'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { DECK } from '@/utils/casino/blackjack/deck'
import type { Card } from '@/utils/casino/blackjack/types'
import {
  drawGoldenJackpot,
  drawLottery,
  drawNextCard,
  dropPlinkoBall,
  dropPlinkoPath,
  flipCoin,
  rollDice,
  shuffleDeck,
  spinRouletteWheel,
  spinSlot
} from '@/utils/casino/rng'

import { card } from '../../helpers/cards'

const cardKey = (c: { suite: string; label: string }) => `${c.suite}:${c.label}`

const mockRandomInt = (value: number) => {
  vi.spyOn(crypto, 'randomInt').mockImplementation(() => value)
}

describe('rng', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rollDice returns 1 when random is 0', () => {
    mockRandomInt(0)
    expect(rollDice()).toBe(1)
  })

  it('rollDice returns 6 when random is at upper bound', () => {
    mockRandomInt(999_999)
    expect(rollDice()).toBe(6)
  })

  it('flipCoin returns heads below 0.5', () => {
    mockRandomInt(400_000)
    expect(flipCoin()).toBe('heads')
  })

  it('flipCoin returns tails at or above 0.5', () => {
    mockRandomInt(600_000)
    expect(flipCoin()).toBe('tails')
  })

  it('spinSlot builds a 3-symbol result from weights', () => {
    mockRandomInt(0)
    const symbolWeights = { ...defaultCasinoSettings.slots.symbolWeights }
    const [onlySymbol] = Object.keys(symbolWeights)
    for (const key of Object.keys(symbolWeights)) {
      symbolWeights[key as keyof typeof symbolWeights] =
        key === onlySymbol ? 1 : 0
    }
    const result = spinSlot({ symbolWeights })
    expect(result).toBe(`${onlySymbol}${onlySymbol}${onlySymbol}`)
  })

  it('drawLottery returns unique numbers in valid range', () => {
    mockRandomInt(0)
    const draw = drawLottery()
    expect(draw).toHaveLength(LOTTERY_NUM_TO_DRAW)
    expect(new Set(draw).size).toBe(LOTTERY_NUM_TO_DRAW)
    draw.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(49)
    })
  })

  it('drawGoldenJackpot returns 1 when random is 0', () => {
    mockRandomInt(0)
    expect(drawGoldenJackpot({ oneInChance: 100 })).toBe(1)
  })

  it('drawGoldenJackpot returns oneInChance when random is at upper bound', () => {
    mockRandomInt(999_999)
    expect(drawGoldenJackpot({ oneInChance: 100 })).toBe(100)
  })

  it('spinRouletteWheel returns a mini roulette key', () => {
    mockRandomInt(0)
    const key = spinRouletteWheel()
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  })

  it('drawNextCard wraps index past deck length', () => {
    const deck: Card[] = [card('2', 2), card('3', 3)]
    expect(drawNextCard(deck, 0)).toEqual(deck[0])
    expect(drawNextCard(deck, 2)).toEqual(deck[0])
  })

  it('shuffleDeck preserves card multiset', () => {
    mockRandomInt(0)
    const shuffled = shuffleDeck(DECK)
    expect(shuffled).toHaveLength(DECK.length)
    expect(shuffled.map(cardKey).sort().join(',')).toBe(
      DECK.map(cardKey).sort().join(',')
    )
  })

  it('dropPlinkoPath returns path ending in rightmost bin when random is 0', () => {
    mockRandomInt(0)
    expect(dropPlinkoPath(4, 0.5).at(-1)).toBe(4)
  })

  it('dropPlinkoPath returns path ending in leftmost bin when random is high', () => {
    mockRandomInt(999_999)
    expect(dropPlinkoPath(4, 0.5).at(-1)).toBe(0)
  })

  it('dropPlinkoBall matches final bin of dropPlinkoPath', () => {
    mockRandomInt(400_000)
    const path = dropPlinkoPath(6, 0.5)
    expect(dropPlinkoBall(6, 0.5)).toBe(path.at(-1))
  })
})
