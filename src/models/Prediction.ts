import { PredictionSchema } from 'gambling-bot-shared/mongoose'
import { TPrediction } from 'gambling-bot-shared/predictions'
import mongoose from 'mongoose'

export default (mongoose.models.Prediction as mongoose.Model<TPrediction>) ||
  mongoose.model<TPrediction>('Prediction', PredictionSchema)
