import crypto from 'crypto'
import {
  LOTTERY_NUM_TO_DRAW,
  defaultCasinoSettings
} from 'gambling-bot-shared/casino'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DECK } from '@/utils/casino/blackjack/deck'
import type { Card } from '@/utils/casino/blackjack/types'
import {
  createShuffledHiloDeck,
  dealHiloCards,
  drawGoldenJackpot,
  drawHiloCard,
  drawLottery,
  drawNextCard,
  dropPlinkoBall,
  dropPlinkoPath,
  flipCoin,
  formatHiloCard,
  rollDice,
  rollHiloCard,
  rollHiloRank,
  rollHiloRanks,
  rollLimbo,
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

  it('rollLimbo floors at 1.00 when U is 1', () => {
    mockRandomInt(0) // random()=0 → U=1 → raw 0.97 → 1.00
    expect(rollLimbo(0.03)).toBe(1)
  })

  it('rollLimbo returns target-style multiplier for mid U', () => {
    mockRandomInt(515_000) // random()=0.515 → U=0.485 → ~2.00
    expect(rollLimbo(0.03)).toBe(2)
  })

  it('deals two distinct cards from one 52-card deck', () => {
    mockRandomInt(0)
    const { first, second } = dealHiloCards()
    expect(`${first.label}${first.suite}`).not.toBe(
      `${second.label}${second.suite}`
    )

    const deck = createShuffledHiloDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map((c) => `${c.label}${c.suite}`)).size).toBe(52)

    const drawn = drawHiloCard(deck)
    expect(formatHiloCard(drawn)).toBe(`${drawn.label}${drawn.suite}`)
    expect(deck).toHaveLength(51)
  })

  it('drawHiloCard throws when the deck is empty', () => {
    expect(() => drawHiloCard([])).toThrow(/Hi-Lo deck is empty/)
  })

  it('rollHiloCard and rollHiloRanks use deck draws', () => {
    mockRandomInt(999_999)
    const card = rollHiloCard()
    expect(card.rank).toBeGreaterThanOrEqual(2)
    expect(card.rank).toBeLessThanOrEqual(14)
    expect(rollHiloRank()).toBeGreaterThanOrEqual(2)

    const ranks = rollHiloRanks()
    expect(ranks.first).toBeGreaterThanOrEqual(2)
    expect(ranks.second).toBeGreaterThanOrEqual(2)
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
