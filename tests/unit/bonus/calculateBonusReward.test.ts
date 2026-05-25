import { calculateBonusReward } from 'gambling-bot-shared'
import { describe, expect, it } from 'vitest'

describe('calculateBonusReward', () => {
  it('uses linear streak increment', () => {
    const { reward } = calculateBonusReward({
      streak: 3,
      settings: {
        rewardMode: 'linear',
        baseReward: 100,
        streakIncrement: 50,
        maxReward: 0,
        resetOnMax: false,
        milestoneBonus: { weekly: 0, monthly: 0 }
      }
    })

    expect(reward).toBe(200)
  })

  it('uses exponential multiplier', () => {
    const { reward } = calculateBonusReward({
      streak: 3,
      settings: {
        rewardMode: 'exponential',
        baseReward: 100,
        streakMultiplier: 2,
        maxReward: 0,
        resetOnMax: false,
        milestoneBonus: { weekly: 0, monthly: 0 }
      }
    })

    expect(reward).toBe(400)
  })

  it('caps reward at maxReward', () => {
    const { reward } = calculateBonusReward({
      streak: 10,
      settings: {
        rewardMode: 'linear',
        baseReward: 100,
        streakIncrement: 100,
        maxReward: 500,
        resetOnMax: false,
        milestoneBonus: { weekly: 0, monthly: 0 }
      }
    })

    expect(reward).toBe(500)
  })

  it('adds weekly milestone on day 7', () => {
    const { reward } = calculateBonusReward({
      streak: 7,
      settings: {
        rewardMode: 'linear',
        baseReward: 100,
        streakIncrement: 0,
        maxReward: 0,
        resetOnMax: false,
        milestoneBonus: { weekly: 250, monthly: 0 }
      }
    })

    expect(reward).toBe(350)
  })

  it('resets linear streak when maxReward exceeded with resetOnMax', () => {
    const { reward } = calculateBonusReward({
      streak: 5,
      settings: {
        rewardMode: 'linear',
        baseReward: 100,
        streakIncrement: 100,
        maxReward: 300,
        resetOnMax: true,
        milestoneBonus: { weekly: 0, monthly: 0 }
      }
    })

    expect(reward).toBe(200)
  })

  it('resets exponential streak when maxReward exceeded with resetOnMax', () => {
    const { reward } = calculateBonusReward({
      streak: 6,
      settings: {
        rewardMode: 'exponential',
        baseReward: 100,
        streakMultiplier: 2,
        maxReward: 500,
        resetOnMax: true,
        milestoneBonus: { weekly: 0, monthly: 0 }
      }
    })

    expect(reward).toBe(400)
  })

  it('adds monthly milestone on day 28', () => {
    const { reward } = calculateBonusReward({
      streak: 28,
      settings: {
        rewardMode: 'linear',
        baseReward: 100,
        streakIncrement: 0,
        maxReward: 0,
        resetOnMax: false,
        milestoneBonus: { weekly: 0, monthly: 1000 }
      }
    })

    expect(reward).toBe(1100)
  })
})
