import { TPrediction, PredictionSchema } from 'gambling-bot-shared'
import { model } from 'mongoose'

export default model<TPrediction>('Prediction', PredictionSchema)
