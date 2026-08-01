import { describe, expect, it } from 'vitest'

import {
  buildSlipBet,
  mergeSlipBet,
  toRouletteBets
} from '@/utils/casino/roulette/slip'

describe('roulette slip helpers', () => {
  it('builds outside and dozen bets', () => {
    expect(buildSlipBet('red', 100)).toEqual({
      amount: 100,
      type: 'color',
      value: 'red',
      displayValue: 'red'
    })

    expect(buildSlipBet('d2', 20)).toEqual({
      amount: 20,
      type: 'dozen',
      value: '2',
      displayValue: 'd2'
    })
  })

  it('merges duplicate outcomes by stacking amounts', () => {
    const first = buildSlipBet('red', 100)
    const second = buildSlipBet('red', 50)
    const third = buildSlipBet('black', 25)

    expect(mergeSlipBet([first], second)).toEqual([{ ...first, amount: 150 }])
    expect(mergeSlipBet([first], third)).toEqual([first, third])
  })

  it('maps slip bets for payout math', () => {
    expect(toRouletteBets([buildSlipBet('17', 10)])).toEqual([
      {
        amount: 10,
        type: 'number',
        value: '17',
        displayValue: '17'
      }
    ])
  })
})
