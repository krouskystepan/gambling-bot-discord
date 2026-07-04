import { createPredictionDb } from 'gambling-bot-shared/predictions'

import Prediction from '@/models/Prediction'

export const predictionDb = createPredictionDb(Prediction)

export const {
  getPredictionById,
  getPredictionToLock,
  createPrediction,
  updatePredictionStatus,
  deletePrediction,
  findPredictions,
  addPredictionBet
} = predictionDb
