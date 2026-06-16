import { createPredictionDb } from 'gambling-bot-shared/services'

import Prediction from '@/models/Prediction'

export const predictionDb = createPredictionDb(Prediction)

export const {
  getPredictionById,
  getPredictionToLock,
  getOldPredictions,
  createPrediction,
  updatePredictionStatus,
  deletePrediction,
  findPredictions,
  addPredictionBet
} = predictionDb
