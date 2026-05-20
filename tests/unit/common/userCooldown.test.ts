import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isUserOnCooldown } from '@/utils/common/userCooldown'

describe('isUserOnCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first action and blocks during cooldown window', () => {
    expect(isUserOnCooldown('user-1')).toBe(false)
    expect(isUserOnCooldown('user-1')).toBe(true)

    vi.advanceTimersByTime(2500)
    expect(isUserOnCooldown('user-1')).toBe(false)
  })

  it('tracks cooldowns per user independently', () => {
    expect(isUserOnCooldown('user-a')).toBe(false)
    expect(isUserOnCooldown('user-b')).toBe(false)
    expect(isUserOnCooldown('user-a')).toBe(true)
    expect(isUserOnCooldown('user-b')).toBe(true)
  })
})
