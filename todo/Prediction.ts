import { Schema, model, Document } from 'mongoose'

type PredictionOption = {
  choiceName: string
  odds: number
  bets: {
    userId: string
    amount: number
  }[]
}

export type Prediction = Document & {
  predictionId: string
  channelId: string
  creatorId: string
  title: string
  choices: PredictionOption[]
  winner: string | null // Added this field for the winner
  status: 'active' | 'ended' | 'paid' | 'cancelled'
  createdAt: Date
}

const PredictionSchema = new Schema<Prediction>({
  predictionId: {
    type: String,
    unique: true,
    required: true,
  },
  channelId: {
    type: String,
    required: true,
  },
  creatorId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  choices: [
    {
      choiceName: { type: String, required: true },
      odds: { type: Number, required: true },
      bets: [
        {
          userId: { type: String, required: true },
          amount: { type: Number, required: true },
        },
      ],
    },
  ],
  winner: {
    type: String,
    default: null, // Initially null, will be set once the prediction is ended
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'paid', 'cancelled'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

export default model<Prediction>('Prediction', PredictionSchema)
