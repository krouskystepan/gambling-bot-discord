import { generateId } from 'gambling-bot-shared/common'
import { validatePredictionChoiceBet } from 'gambling-bot-shared/predictions'

import { refundLockedBet, reserveCasinoBet } from '@/services/casino'
import { addPredictionBet, getPredictionById } from '@/services/db'

export class PlacePredictionBetError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PREDICTION_NOT_FOUND'
      | 'PREDICTION_NOT_ACTIVE'
      | 'CHOICE_NOT_FOUND'
      | 'VALIDATION_FAILED'
      | 'PREDICTION_STATE_CHANGED'
  ) {
    super(message)
    this.name = 'PlacePredictionBetError'
  }
}

export const placePredictionBet = async ({
  userId,
  guildId,
  predictionId,
  choiceName,
  amount,
  minBet,
  maxBet
}: {
  userId: string
  guildId: string
  predictionId: string
  choiceName: string
  amount: number
  minBet: number
  maxBet: number
}) => {
  const prediction = await getPredictionById({ predictionId, guildId })
  if (!prediction) {
    throw new PlacePredictionBetError(
      'Prediction not found',
      'PREDICTION_NOT_FOUND'
    )
  }

  if (prediction.status !== 'active') {
    throw new PlacePredictionBetError(
      'Prediction is not active',
      'PREDICTION_NOT_ACTIVE'
    )
  }

  const choice = prediction.choices?.find((c) => c.choiceName === choiceName)
  if (!choice) {
    throw new PlacePredictionBetError('Choice not found', 'CHOICE_NOT_FOUND')
  }

  const userChoiceTotal = choice.bets
    .filter((bet) => bet.userId === userId)
    .reduce((sum, bet) => sum + bet.amount, 0)

  const validation = validatePredictionChoiceBet({
    userChoiceTotal,
    parsedBetAmount: amount,
    maxBet,
    minBet
  })

  if (!validation.ok) {
    throw new PlacePredictionBetError(validation.error, 'VALIDATION_FAILED')
  }

  const betId = generateId()

  await reserveCasinoBet({
    userId,
    guildId,
    totalBet: amount,
    betId,
    game: 'prediction'
  })

  const added = await addPredictionBet({
    predictionId,
    guildId,
    userId,
    amount,
    choiceName,
    betId
  })

  if (!added) {
    await refundLockedBet({
      userId,
      guildId,
      amount,
      betId,
      game: 'prediction'
    })
    throw new PlacePredictionBetError(
      'Prediction state changed after funds were reserved',
      'PREDICTION_STATE_CHANGED'
    )
  }
}
