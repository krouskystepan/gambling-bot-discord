import { DAY_MS } from 'gambling-bot-shared/common'
import {
  minesAutoResolveIdleMs,
  minesIdleNudgeThresholdMs
} from 'gambling-bot-shared/mines'

import MinesGame from '@/models/MinesGame'

import { TGetMinesGame, TUpsertMinesGame } from './minesGame.db.types'

export const getMinesGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetMinesGame) => {
  return MinesGame.findOne({ userId, guildId })
}

export const getMinesGameByBetId = async ({
  betId,
  guildId
}: {
  betId: string
  guildId: string
}) => {
  return MinesGame.findOne({ betId, guildId })
}

export const getMinesGamesByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  return MinesGame.find({ guildId })
}

export const getAllOldMinesGames = async (days: number) => {
  return MinesGame.find({
    status: 'ACTIVE',
    updatedAt: {
      $lte: new Date(Date.now() - days * DAY_MS)
    }
  })
}

export const getMinesGamesNeedingIdleNudge = async () => {
  const now = Date.now()

  return MinesGame.find({
    status: 'ACTIVE',
    updatedAt: {
      $lte: new Date(now - minesIdleNudgeThresholdMs()),
      $gt: new Date(now - minesAutoResolveIdleMs())
    },
    $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
  })
}

export const markMinesIdleNudgeSent = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  return MinesGame.findOneAndUpdate(
    {
      userId,
      guildId,
      $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
    },
    { $set: { idleNudgeSentAt: new Date() } },
    { returnDocument: 'after' }
  )
}

export const updateMinesGame = async (game: typeof MinesGame.prototype) => {
  game.idleNudgeSentAt = null
  await game.save()
}

export const upsertMinesGame = async ({
  userId,
  guildId,
  channelId,
  messageId,
  betId,
  betAmount,
  mineCount,
  mineIndices,
  revealedIndices,
  houseEdgeSnapshot,
  status
}: TUpsertMinesGame) => {
  return MinesGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        channelId,
        messageId,
        betId,
        betAmount,
        mineCount,
        mineIndices,
        revealedIndices,
        houseEdgeSnapshot,
        status,
        idleNudgeSentAt: null
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  )
}

export const deleteMinesGame = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  await MinesGame.findOneAndDelete({ userId, guildId })
}
