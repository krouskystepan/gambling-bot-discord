export type BetValidationError =
  | 'INVALID_NUMBER'
  | 'TOO_MANY_DECIMALS'
  | 'BELOW_MINIMUM'
  | 'ABOVE_MAXIMUM'
  | 'BELOW_MIN_BET'

export type BetValidationResult =
  | { ok: true }
  | { ok: false; error: BetValidationError }

export const validateBetAmount = (
  betAmount: number,
  maxBet: number,
  minBet: number
): BetValidationResult => {
  if (!Number.isFinite(betAmount)) {
    return { ok: false, error: 'INVALID_NUMBER' }
  }

  const betCentsRaw = betAmount * 100
  const betCents = Math.round(betCentsRaw)

  if (Math.abs(betCentsRaw - betCents) > 1e-6) {
    return { ok: false, error: 'TOO_MANY_DECIMALS' }
  }

  if (betAmount < 1) {
    return { ok: false, error: 'BELOW_MINIMUM' }
  }

  const minBetCents = Math.floor(minBet * 100)
  const maxBetCents = Math.floor(maxBet * 100)

  if (maxBetCents > 0 && betCents > maxBetCents) {
    return { ok: false, error: 'ABOVE_MAXIMUM' }
  }

  if (minBetCents > 0 && betCents < minBetCents) {
    return { ok: false, error: 'BELOW_MIN_BET' }
  }

  return { ok: true }
}
