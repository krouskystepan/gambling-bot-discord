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

  it('loses color on mismatched color', () => {
    expect(calculateRouletteWin(bet('color', 'red'), '2', payouts)).toBe(0)
  })

  it('loses color on zero', () => {
    expect(calculateRouletteWin(bet('color', 'red'), '0', payouts)).toBe(0)
  })

  it('pays parity on non-zero result', () => {
    expect(calculateRouletteWin(bet('parity', 'even'), '2', payouts)).toBe(
      100 * payouts.parity
    )
  })

  it('loses parity on mismatched parity', () => {
    expect(calculateRouletteWin(bet('parity', 'odd'), '2', payouts)).toBe(0)
  })

  it('pays parity on odd result', () => {
    expect(calculateRouletteWin(bet('parity', 'odd'), '3', payouts)).toBe(
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

  it('loses range on mismatched range', () => {
    expect(calculateRouletteWin(bet('range', 'high'), '5', payouts)).toBe(0)
  })

  it('pays range on high result', () => {
    expect(calculateRouletteWin(bet('range', 'high'), '10', payouts)).toBe(
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

  it('loses column on mismatched column', () => {
    expect(calculateRouletteWin(bet('column', '1'), '5', payouts)).toBe(0)
  })

  it('loses column on zero', () => {
    expect(calculateRouletteWin(bet('column', '2'), '0', payouts)).toBe(0)
  })

  it('loses dozen on mismatched dozen', () => {
    expect(calculateRouletteWin(bet('dozen', '2'), '5', payouts)).toBe(0)
  })

  it('returns zero for unknown bet type', () => {
    const unknown = {
      type: 'unknown',
      value: 'x',
      amount: 100,
      displayValue: 'x'
    } as unknown as RouletteBet

    expect(calculateRouletteWin(unknown, '5', payouts)).toBeUndefined()
  })
})
