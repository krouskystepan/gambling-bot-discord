export type PredictionBetValidationError =
  | 'BELOW_MIN_BET'
  | 'ABOVE_MAX_PER_CHOICE'

export type PredictionBetValidationResult =
  | { ok: true }
  | { ok: false; error: PredictionBetValidationError }

export const validatePredictionChoiceBet = ({
  userChoiceTotal,
  parsedBetAmount,
  maxBet,
  minBet
}: {
  userChoiceTotal: number
  parsedBetAmount: number
  maxBet: number
  minBet: number
}): PredictionBetValidationResult => {
  if (minBet > 0 && parsedBetAmount < minBet) {
    return { ok: false, error: 'BELOW_MIN_BET' }
  }

  const newChoiceTotal = userChoiceTotal + parsedBetAmount
  if (maxBet > 0 && newChoiceTotal > maxBet) {
    return { ok: false, error: 'ABOVE_MAX_PER_CHOICE' }
  }

  return { ok: true }
}
