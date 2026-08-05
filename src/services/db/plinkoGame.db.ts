import { emptySessionStats } from 'gambling-bot-shared/casino'
import {
  plinkoIdleCloseMs,
  plinkoIdleNudgeThresholdMs
} from 'gambling-bot-shared/plinko'

import PlinkoGame from '@/models/PlinkoGame'

import {
  TGetPlinkoGame,
  TUpdatePlinkoGame,
  TUpsertPlinkoGame
} from './plinkoGame.db.types'

export const getPlinkoGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetPlinkoGame) => {
  return PlinkoGame.findOne({ userId, guildId })
}

export const getPlinkoGameByGameId = async ({
  gameId,
  guildId
}: {
  gameId: string
  guildId: string
}) => {
  return PlinkoGame.findOne({ gameId, guildId })
}

export const getPlinkoGamesByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  return PlinkoGame.find({ guildId })
}

export const getAllOldPlinkoGames = async (days: number) => {
  return PlinkoGame.find({
    updatedAt: {
      $lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }
  })
}

export const getPlinkoGamesNeedingIdleNudge = async () => {
  const now = Date.now()

  return PlinkoGame.find({
    updatedAt: {
      $lte: new Date(now - plinkoIdleNudgeThresholdMs()),
      $gt: new Date(now - plinkoIdleCloseMs())
    },
    $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
  })
}

export const markPlinkoIdleNudgeSent = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  return PlinkoGame.findOneAndUpdate(
    {
      userId,
      guildId,
      $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
    },
    { $set: { idleNudgeSentAt: new Date() } },
    { returnDocument: 'after' }
  )
}

export const upsertPlinkoGame = async ({
  userId,
  guildId,
  channelId,
  messageId,
  gameId,
  showBalance,
  skipAnimations,
  unitBet = null,
  ballsCount = 1,
  phase = 'ready',
  lastNetResult = null,
  lastBallsCount = null,
  lastTotalBet = null,
  lastWinsCount = null,
  pendingBatchResults = null,
  activeBetId = null,
  lockedAmount = null,
  sessionStats
}: TUpsertPlinkoGame) => {
  return PlinkoGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        channelId,
        messageId,
        gameId,
        showBalance,
        skipAnimations,
        unitBet,
        ballsCount,
        phase,
        lastNetResult,
        lastBallsCount,
        lastTotalBet,
        lastWinsCount,
        pendingBatchResults,
        activeBetId,
        lockedAmount,
        sessionStats: sessionStats ?? emptySessionStats(),
        idleNudgeSentAt: null
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  )
}

export const updatePlinkoGame = async ({
  userId,
  guildId,
  ...patch
}: TUpdatePlinkoGame) => {
  return PlinkoGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        ...patch,
        idleNudgeSentAt: null
      }
    },
    { returnDocument: 'after' }
  )
}

export const deletePlinkoGame = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  await PlinkoGame.findOneAndDelete({ userId, guildId })
}

export const getStaleDroppingPlinkoGames = async (graceMs: number) => {
  const cutoff = new Date(Date.now() - graceMs)

  return PlinkoGame.find({
    updatedAt: { $lte: cutoff },
    $or: [{ phase: 'dropping' }, { activeBetId: { $ne: null } }]
  })
}
