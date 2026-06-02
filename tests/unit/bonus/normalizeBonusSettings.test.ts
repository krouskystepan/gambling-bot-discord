import {
  BONUS_MAX_AMOUNT,
  BONUS_MAX_STREAK_MULTIPLIER,
  normalizeBonusSettings
} from 'gambling-bot-shared'
import { bonusFormSchema } from 'gambling-bot-shared/schemas'
import { describe, expect, it } from 'vitest'

describe('normalizeBonusSettings', () => {
  it('clamps currency fields to BONUS_MAX_AMOUNT', () => {
    const normalized = normalizeBonusSettings({
      rewardMode: 'linear',
      baseReward: 99_999_999_999,
      streakIncrement: 50_000_000,
      maxReward: 1_000_000_000,
      resetOnMax: false,
      milestoneBonus: { weekly: 20_000_000, monthly: 30_000_000 }
    })

    expect(normalized.baseReward).toBe(BONUS_MAX_AMOUNT)
    expect(normalized.streakIncrement).toBe(BONUS_MAX_AMOUNT)
    expect(normalized.maxReward).toBe(BONUS_MAX_AMOUNT)
    expect(normalized.milestoneBonus.weekly).toBe(BONUS_MAX_AMOUNT)
    expect(normalized.milestoneBonus.monthly).toBe(BONUS_MAX_AMOUNT)
  })

  it('clamps streak multiplier to prevent overflow', () => {
    const normalized = normalizeBonusSettings({
      rewardMode: 'exponential',
      baseReward: 100,
      streakMultiplier: 999,
      maxReward: 0,
      resetOnMax: false,
      milestoneBonus: { weekly: 0, monthly: 0 }
    })

    expect(normalized.streakMultiplier).toBe(BONUS_MAX_STREAK_MULTIPLIER)
  })
})

describe('bonusFormSchema', () => {
  it('rejects amounts above the cap', () => {
    const result = bonusFormSchema.safeParse({
      rewardMode: 'linear',
      baseReward: BONUS_MAX_AMOUNT + 1,
      streakIncrement: 0,
      maxReward: 0,
      resetOnMax: false,
      milestoneBonus: { weekly: 0, monthly: 0 }
    })

    expect(result.success).toBe(false)
  })
})
