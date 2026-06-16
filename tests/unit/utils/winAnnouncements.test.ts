import {
  shouldAnnounceByMultiplier,
  shouldAnnounceGoldenJackpotHit,
  shouldAnnouncePlinkoBall
} from 'gambling-bot-shared/casino'
import { describe, expect, it } from 'vitest'

describe('shouldAnnounceByMultiplier', () => {
  it('returns true when multiplier meets a positive minimum', () => {
    expect(shouldAnnounceByMultiplier(100, 100)).toBe(true)
    expect(shouldAnnounceByMultiplier(8, 6)).toBe(true)
  })

  it('returns false when multiplier is below the minimum', () => {
    expect(shouldAnnounceByMultiplier(50, 100)).toBe(false)
  })

  it('returns false when minimum is zero or negative (disabled)', () => {
    expect(shouldAnnounceByMultiplier(100, 0)).toBe(false)
    expect(shouldAnnounceByMultiplier(100, -1)).toBe(false)
  })
})

describe('shouldAnnouncePlinkoBall', () => {
  it('returns true when multiplier meets the minimum', () => {
    expect(shouldAnnouncePlinkoBall(6, 6)).toBe(true)
    expect(shouldAnnouncePlinkoBall(8, 6)).toBe(true)
  })

  it('returns false when multiplier is below the minimum', () => {
    expect(shouldAnnouncePlinkoBall(5.99, 6)).toBe(false)
    expect(shouldAnnouncePlinkoBall(1, 6)).toBe(false)
  })
})

describe('shouldAnnounceGoldenJackpotHit', () => {
  it('returns true when win multiplier meets the minimum', () => {
    expect(shouldAnnounceGoldenJackpotHit(10_000, 1)).toBe(true)
    expect(shouldAnnounceGoldenJackpotHit(5_000, 5_000)).toBe(true)
  })

  it('returns false when win multiplier is below the minimum', () => {
    expect(shouldAnnounceGoldenJackpotHit(100, 1_000)).toBe(false)
  })
})
