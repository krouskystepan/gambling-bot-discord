import {
  TPrediction,
  PredictionSchema,
} from '@krouskystepan/gambling-bot-shared'
import { model } from 'mongoose'

export default model<TPrediction>('Prediction', PredictionSchema)
