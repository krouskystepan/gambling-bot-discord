import { defaultCasinoSettings } from 'gambling-bot-shared'

import { describe, expect, it } from 'vitest'

import { calculateRouletteWin } from '@/utils/casino/roulette/math'
import { RouletteBet } from '@/utils/casino/roulette/types'

const payouts = defaultCasinoSettings.roulette.winMultipliers

const bet = (
  type: RouletteBet['type'],
  value: string,
  amount = 100
): RouletteBet => ({
  type,
  value,
  amount,
  displayValue: value
})

describe('calculateRouletteWin', () => {
  it('pays on matching number', () => {
    expect(calculateRouletteWin(bet('number', '17'), '17', payouts)).toBe(
      100 * payouts.number
    )
  })

  it('loses on mismatched number', () => {
    expect(calculateRouletteWin(bet('number', '17'), '3', payouts)).toBe(0)
  })

  it('pays color on non-zero result', () => {
    expect(calculateRouletteWin(bet('color', 'red'), '1', payouts)).toBe(
      100 * payouts.color
    )
  })

  it('loses color on zero', () => {
    expect(calculateRouletteWin(bet('color', 'red'), '0', payouts)).toBe(0)
  })

  it('pays parity on non-zero result', () => {
    expect(calculateRouletteWin(bet('parity', 'even'), '2', payouts)).toBe(
      100 * payouts.parity
    )
  })

  it('loses parity on zero', () => {
    expect(calculateRouletteWin(bet('parity', 'even'), '0', payouts)).toBe(0)
  })

  it('pays range on non-zero result', () => {
    expect(calculateRouletteWin(bet('range', 'low'), '5', payouts)).toBe(
      100 * payouts.range
    )
  })

  it('loses range on zero', () => {
    expect(calculateRouletteWin(bet('range', 'low'), '0', payouts)).toBe(0)
  })

  it('pays dozen on non-zero result', () => {
    expect(calculateRouletteWin(bet('dozen', '1'), '5', payouts)).toBe(
      100 * payouts.dozen
    )
  })

  it('loses dozen on zero', () => {
    expect(calculateRouletteWin(bet('dozen', '1'), '0', payouts)).toBe(0)
  })

  it('pays column on non-zero result', () => {
    expect(calculateRouletteWin(bet('column', '2'), '5', payouts)).toBe(
      100 * payouts.column
    )
  })

  it('loses column on zero', () => {
    expect(calculateRouletteWin(bet('column', '2'), '0', payouts)).toBe(0)
  })
})
