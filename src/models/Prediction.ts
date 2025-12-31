import { PredictionSchema, TPrediction } from 'gambling-bot-shared'
import { model } from 'mongoose'

export default model<TPrediction>('Prediction', PredictionSchema)
