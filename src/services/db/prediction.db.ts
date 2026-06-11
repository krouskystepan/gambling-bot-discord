import { TPrediction } from 'gambling-bot-shared'
import mongoose from 'mongoose'

import Prediction from '@/models/Prediction'
import {
  TAddPredictionBet,
  TCreatePrediction,
  TGetOldPredictions,
  TGetPrediction,
  TUpdatePredictionStatus
} from '@/types/types'

export const getPredictionById = async ({
  predictionId,
  guildId
}: TGetPrediction) => {
  return Prediction.findOne({ predictionId, guildId })
}

export const getPredictionToLock = async ({
  status = 'active',
  useAutolock = true
}: {
  status?: TPrediction['status']
  useAutolock?: boolean
}) => {
  const now = new Date()

  return Prediction.find({
    status,
    ...(useAutolock ? { autolock: { $lte: now } } : {})
  })
}

export const getOldPredictions = async ({
  statuses,
  olderThanDays
}: TGetOldPredictions) => {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

  return Prediction.find({
    status: { $in: statuses },
    updatedAt: { $lte: cutoffDate }
  })
}

export const createPrediction = async ({
  predictionId,
  guildId,
  channelId,
  creatorId,
  title,
  choices,
  autolock,
  status
}: TCreatePrediction) => {
  await Prediction.create({
    predictionId,
    guildId,
    channelId,
    creatorId,
    title,
    choices,
    autolock,
    status
  })
}

export const updatePredictionStatus = async ({
  predictionId,
  guildId,
  fromStatus,
  toStatus
}: TUpdatePredictionStatus) => {
  return Prediction.findOneAndUpdate(
    {
      predictionId,
      guildId,
      status: Array.isArray(fromStatus) ? { $in: fromStatus } : fromStatus
    },
    { $set: { status: toStatus } },
    { returnDocument: 'after' }
  )
}

export const deletePrediction = async ({
  predictionId
}: {
  predictionId: string
}) => {
  await Prediction.deleteOne({ predictionId })
}

type PredictionDoc = mongoose.InferSchemaType<typeof Prediction.schema>
export const findPredictions = async (
  query: mongoose.mongo.Filter<PredictionDoc>
) => {
  return Prediction.find(query).limit(25)
}

export const addPredictionBet = async ({
  predictionId,
  guildId,
  choiceName,
  userId,
  amount,
  betId
}: TAddPredictionBet) => {
  return Prediction.findOneAndUpdate(
    {
      predictionId,
      guildId,
      'choices.choiceName': choiceName
    },
    {
      $push: {
        'choices.$.bets': {
          userId,
          amount,
          betId
        }
      }
    }
  )
}
