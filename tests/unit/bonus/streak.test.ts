import { describe, expect, it } from 'vitest'

import {
  canClaimDailyBonus,
  getStreakAfterClaim,
  getStreakDisplay
} from '@/utils/bonus/streak'

describe('daily bonus streak helpers', () => {
  const now = new Date('2026-05-20T12:00:00Z')

  it('allows claim when never claimed', () => {
    expect(canClaimDailyBonus(null, now)).toBe(true)
  })

  it('blocks claim within 24 hours', () => {
    const lastClaim = new Date('2026-05-20T08:00:00Z')
    expect(canClaimDailyBonus(lastClaim, now)).toBe(false)
  })

  it('allows claim after 24 hours', () => {
    const lastClaim = new Date('2026-05-19T08:00:00Z')
    expect(canClaimDailyBonus(lastClaim, now)).toBe(true)
  })

  it('starts streak at 1 when never claimed before', () => {
    expect(getStreakAfterClaim(null, now, 9)).toBe(1)
  })

  it('increments streak when claimed within 48 hours', () => {
    const lastClaim = new Date('2026-05-19T14:00:00Z')
    expect(getStreakAfterClaim(lastClaim, now, 4)).toBe(5)
  })

  it('resets streak after 48 hours', () => {
    const lastClaim = new Date('2026-05-17T12:00:00Z')
    expect(getStreakAfterClaim(lastClaim, now, 9)).toBe(1)
  })

  it('shows first streak when never claimed', () => {
    expect(getStreakDisplay(null, now, 0)).toEqual({
      currentStreak: 0,
      nextStreak: 1
    })
  })

  it('shows next streak while still in window', () => {
    const lastClaim = new Date('2026-05-20T08:00:00Z')
    expect(getStreakDisplay(lastClaim, now, 3)).toEqual({
      currentStreak: 3,
      nextStreak: 4
    })
  })

  it('resets display streak after window expires', () => {
    const lastClaim = new Date('2026-05-17T12:00:00Z')
    expect(getStreakDisplay(lastClaim, now, 5)).toEqual({
      currentStreak: 0,
      nextStreak: 1
    })
  })
})
