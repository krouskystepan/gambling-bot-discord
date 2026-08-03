import { describe, expect, it } from 'vitest'

import {
  baccaratLockedTotal,
  buildSlipBet,
  mergeSlipBet,
  slipTotal
} from '@/utils/casino/baccarat/slip'

describe('baccarat slip', () => {
  it('builds and totals slip bets', () => {
    expect(buildSlipBet('player', 50)).toEqual({ side: 'player', amount: 50 })
    expect(slipTotal([])).toBe(0)
    expect(
      slipTotal([
        { side: 'player', amount: 100 },
        { side: 'tie', amount: 25 }
      ])
    ).toBe(125)
  })

  it('merges amounts for the same side and appends new sides', () => {
    const first = mergeSlipBet([], buildSlipBet('player', 100))
    expect(first).toEqual([{ side: 'player', amount: 100 }])

    const merged = mergeSlipBet(first, buildSlipBet('player', 50))
    expect(merged).toEqual([{ side: 'player', amount: 150 }])

    const withTie = mergeSlipBet(merged, buildSlipBet('tie', 20))
    expect(withTie).toEqual([
      { side: 'player', amount: 150 },
      { side: 'tie', amount: 20 }
    ])
  })

  it('keeps side when merging onto a non-enumerable mongoose-like bet', () => {
    const existing = Object.defineProperties(
      {} as { side: 'player'; amount: number },
      {
        side: { get: () => 'player' as const, enumerable: false },
        amount: { get: () => 100, enumerable: false }
      }
    )

    expect({ ...existing }).toEqual({})

    const merged = mergeSlipBet([existing], buildSlipBet('player', 25))
    expect(merged).toEqual([{ side: 'player', amount: 125 }])
  })

  it('prefers lockedAmount and falls back to summing bets', () => {
    expect(baccaratLockedTotal({ lockedAmount: 200, bets: [] })).toBe(200)
    expect(
      baccaratLockedTotal({
        lockedAmount: null,
        bets: [{ side: 'banker', amount: 75 }]
      })
    ).toBe(75)
    expect(baccaratLockedTotal({ lockedAmount: 0, bets: null })).toBe(0)
    expect(baccaratLockedTotal({})).toBe(0)
  })
})
