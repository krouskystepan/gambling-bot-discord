import { Schema, model, Document } from 'mongoose'

export type PredictionOption = {
  choiceName: string
  odds: number
  bets: {
    userId: string
    amount: number
  }[]
}

export type Prediction = Document & {
  predictionId: string
  guildId: string
  channelId: string
  creatorId: string
  title: string
  choices: PredictionOption[]
  status: 'active' | 'ended' | 'paid' | 'canceled'
  createdAt: Date
  updatedAt: Date
}

const PredictionSchema = new Schema<Prediction>(
  {
    predictionId: {
      type: String,
      required: true,
    },
    guildId: {
      type: String,
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
    status: {
      type: String,
      enum: ['active', 'ended', 'paid', 'canceled'],
      default: 'active',
    },
  },
  { timestamps: true }
)

PredictionSchema.index({ predictionId: 1, guildId: 1 }, { unique: true })

export default model<Prediction>('Prediction', PredictionSchema)
