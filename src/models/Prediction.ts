import { PredictionSchema, TPrediction } from 'gambling-bot-shared'
import mongoose from 'mongoose'

export default (mongoose.models.Prediction as mongoose.Model<TPrediction>) ||
  mongoose.model<TPrediction>('Prediction', PredictionSchema)
