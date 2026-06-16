import {
  type PayPredictionResult,
  createPredictionLifecycleService
} from 'gambling-bot-shared/predictions'

import { refundLockedBet, settleCasinoWinnings } from '@/services/casino'
import { predictionDb } from '@/services/db/prediction.db'

const predictionLifecycle = createPredictionLifecycleService({
  predictionDb,
  casinoBet: { refundLockedBet, settleCasinoWinnings }
})

export type { PayPredictionResult }

export const payPrediction = predictionLifecycle.payoutPrediction
export const endPrediction = predictionLifecycle.endPrediction
export const cancelPrediction = predictionLifecycle.cancelPrediction
