import { TPrediction } from 'gambling-bot-shared'
import { FilterQuery } from 'mongoose'

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
  status?: string
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
    { new: true }
  )
}

export const deletePrediction = async ({
  predictionId
}: {
  predictionId: string
}) => {
  Prediction.deleteOne({ predictionId })
}

export const findPredictions = async (query: FilterQuery<TPrediction>) => {
  const predictions = await Prediction.find(query).limit(25)

  return predictions
}

export const addPredictionBet = async ({
  predictionId,
  guildId,
  choiceName,
  userId,
  amount
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
          amount
        }
      }
    }
  )
}
