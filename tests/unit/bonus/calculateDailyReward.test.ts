import { describe, expect, it } from 'vitest'

import { calculateDailyReward } from '@/utils/bonus/calculateDailyReward'

describe('calculateDailyReward', () => {
  it('uses linear streak increment', () => {
    const reward = calculateDailyReward(3, {
      rewardMode: 'linear',
      baseReward: 100,
      streakIncrement: 50
    })

    expect(reward).toBe(200)
  })

  it('uses exponential multiplier', () => {
    const reward = calculateDailyReward(3, {
      rewardMode: 'exponential',
      baseReward: 100,
      streakMultiplier: 2
    })

    expect(reward).toBe(400)
  })

  it('caps reward at maxReward', () => {
    const reward = calculateDailyReward(10, {
      rewardMode: 'linear',
      baseReward: 100,
      streakIncrement: 100,
      maxReward: 500,
      resetOnMax: false
    })

    expect(reward).toBe(500)
  })

  it('adds weekly milestone on day 7', () => {
    const reward = calculateDailyReward(7, {
      rewardMode: 'linear',
      baseReward: 100,
      streakIncrement: 0,
      milestoneBonus: { weekly: 250 }
    })

    expect(reward).toBe(350)
  })

  it('resets linear streak when maxReward exceeded with resetOnMax', () => {
    const reward = calculateDailyReward(5, {
      rewardMode: 'linear',
      baseReward: 100,
      streakIncrement: 100,
      maxReward: 300,
      resetOnMax: true
    })

    expect(reward).toBe(200)
  })

  it('resets exponential streak when maxReward exceeded with resetOnMax', () => {
    const reward = calculateDailyReward(6, {
      rewardMode: 'exponential',
      baseReward: 100,
      streakMultiplier: 2,
      maxReward: 500,
      resetOnMax: true
    })

    expect(reward).toBe(400)
  })

  it('adds monthly milestone on day 28', () => {
    const reward = calculateDailyReward(28, {
      rewardMode: 'linear',
      baseReward: 100,
      streakIncrement: 0,
      milestoneBonus: { monthly: 1000 }
    })

    expect(reward).toBe(1100)
  })
})
