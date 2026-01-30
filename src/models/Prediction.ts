import { TPrediction } from 'gambling-bot-shared'
import { PredictionSchema } from 'gambling-bot-shared/server'
import mongoose from 'mongoose'

export default (mongoose.models.Prediction as mongoose.Model<TPrediction>) ||
  mongoose.model<TPrediction>('Prediction', PredictionSchema)
