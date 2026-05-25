import { describe, expect, it } from 'vitest'

import { validatePredictionChoiceBet } from 'gambling-bot-shared'

describe('validatePredictionChoiceBet', () => {
  it('accepts valid bet within per-choice limit', () => {
    expect(
      validatePredictionChoiceBet({
        userChoiceTotal: 100,
        parsedBetAmount: 50,
        maxBet: 500,
        minBet: 10
      })
    ).toEqual({ ok: true })
  })

  it('rejects bet below minimum', () => {
    expect(
      validatePredictionChoiceBet({
        userChoiceTotal: 0,
        parsedBetAmount: 5,
        maxBet: 500,
        minBet: 10
      })
    ).toEqual({ ok: false, error: 'BELOW_MIN_BET' })
  })

  it('rejects bet exceeding per-choice maximum', () => {
    expect(
      validatePredictionChoiceBet({
        userChoiceTotal: 450,
        parsedBetAmount: 100,
        maxBet: 500,
        minBet: 0
      })
    ).toEqual({ ok: false, error: 'ABOVE_MAX_PER_CHOICE' })
  })
})
