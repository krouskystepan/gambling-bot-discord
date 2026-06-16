import { validateBetAmount } from 'gambling-bot-shared/casino'
import { describe, expect, it } from 'vitest'

describe('validateBetAmount', () => {
  it('accepts valid bet within limits', () => {
    expect(validateBetAmount(50, 1000, 10)).toEqual({ ok: true })
  })

  it('rejects non-finite numbers', () => {
    expect(validateBetAmount(Number.NaN, 0, 0)).toEqual({
      ok: false,
      error: 'INVALID_NUMBER'
    })
  })

  it('rejects more than two decimal places', () => {
    expect(validateBetAmount(1.234, 0, 0)).toEqual({
      ok: false,
      error: 'TOO_MANY_DECIMALS'
    })
  })

  it('rejects bets below $1', () => {
    expect(validateBetAmount(0.5, 0, 0)).toEqual({
      ok: false,
      error: 'BELOW_MINIMUM'
    })
  })

  it('rejects bets above max', () => {
    expect(validateBetAmount(500, 100, 0)).toEqual({
      ok: false,
      error: 'ABOVE_MAXIMUM'
    })
  })

  it('rejects bets below min', () => {
    expect(validateBetAmount(5, 0, 10)).toEqual({
      ok: false,
      error: 'BELOW_MIN_BET'
    })
  })
})
