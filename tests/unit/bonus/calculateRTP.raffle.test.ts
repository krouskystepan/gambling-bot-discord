import { calculateRTP } from 'gambling-bot-shared/casino'
import { describe, expect, it } from 'vitest'

describe('calculateRTP raffle', () => {
  it('returns payout percentage from casino cut', () => {
    expect(calculateRTP('raffle', { houseEdge: 0.01 })).toBe(99)
  })
})
