import {
  baccaratIdleNudgeThresholdMs,
  baccaratIdleRefundMs
} from 'gambling-bot-shared/baccarat'

import BaccaratGame from '@/models/BaccaratGame'

import { TGetBaccaratGame, TUpsertBaccaratGame } from './baccaratGame.db.types'

export const getBaccaratGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetBaccaratGame) => {
  return BaccaratGame.findOne({ userId, guildId })
}

export const getBaccaratGameByBetId = async ({
  betId,
  guildId
}: {
  betId: string
  guildId: string
}) => {
  return BaccaratGame.findOne({ betId, guildId })
}

export const getBaccaratGamesByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  return BaccaratGame.find({ guildId })
}

export const getAllOldBaccaratGames = async (days: number) => {
  return BaccaratGame.find({
    updatedAt: {
      $lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }
  })
}

export const getBaccaratGamesNeedingIdleNudge = async () => {
  const now = Date.now()

  return BaccaratGame.find({
    updatedAt: {
      $lte: new Date(now - baccaratIdleNudgeThresholdMs()),
      $gt: new Date(now - baccaratIdleRefundMs())
    },
    $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
  })
}

export const markBaccaratIdleNudgeSent = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  return BaccaratGame.findOneAndUpdate(
    {
      userId,
      guildId,
      $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
    },
    { $set: { idleNudgeSentAt: new Date() } },
    { returnDocument: 'after' }
  )
}

export const upsertBaccaratGame = async ({
  userId,
  guildId,
  channelId,
  messageId,
  betId,
  betAmount,
  showBalance,
  skipAnimations
}: TUpsertBaccaratGame) => {
  return BaccaratGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        channelId,
        messageId,
        betId,
        betAmount,
        showBalance,
        skipAnimations,
        idleNudgeSentAt: null
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  )
}

export const deleteBaccaratGame = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  await BaccaratGame.findOneAndDelete({ userId, guildId })
}
