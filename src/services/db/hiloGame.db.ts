import {
  hiloGuessTimeoutMs,
  hiloIdleCloseMs,
  hiloIdleNudgeThresholdMs
} from 'gambling-bot-shared/casino'
import { emptySessionStats } from 'gambling-bot-shared/casino'

import HiloGame from '@/models/HiloGame'

import type {
  TGetHiloGame,
  TUpdateHiloGame,
  TUpsertHiloGame
} from './hiloGame.db.types'

export const getHiloGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetHiloGame) => {
  return HiloGame.findOne({ userId, guildId })
}

export const getHiloGameByGameId = async ({
  gameId,
  guildId
}: {
  gameId: string
  guildId: string
}) => {
  return HiloGame.findOne({ gameId, guildId })
}

export const getHiloGamesByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  return HiloGame.find({ guildId })
}

/** Waiting rounds past the guess timeout - cash out or safest auto-guess. */
export const getTimedOutHiloGames = async () => {
  return HiloGame.find({
    status: 'WAITING',
    updatedAt: {
      $lte: new Date(Date.now() - hiloGuessTimeoutMs())
    }
  })
}

/** Waiting rounds idle long enough for a one-time DM reminder. */
export const getHiloGamesNeedingIdleNudge = async () => {
  const now = Date.now()

  return HiloGame.find({
    status: 'WAITING',
    updatedAt: {
      $lte: new Date(now - hiloIdleNudgeThresholdMs()),
      $gt: new Date(now - hiloGuessTimeoutMs())
    },
    $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
  })
}

/** Empty or settled tables idle long enough for the idle-close worker. */
export const getOldIdleHiloGames = async () => {
  return HiloGame.find({
    status: { $in: ['BETTING', 'RESULT'] },
    updatedAt: {
      $lte: new Date(Date.now() - hiloIdleCloseMs())
    }
  })
}

export const markHiloIdleNudgeSent = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  return HiloGame.updateOne(
    {
      userId,
      guildId,
      status: 'WAITING',
      $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
    },
    { $set: { idleNudgeSentAt: new Date() } }
  )
}

export const upsertHiloGame = async ({
  userId,
  guildId,
  channelId,
  messageId,
  gameId,
  activeBetId = null,
  betAmount,
  firstCard = null,
  remainingDeck = [],
  currentMultiplier = 1,
  streak = 0,
  houseEdgeSnapshot,
  showBalance,
  skipAnimations = false,
  status = 'BETTING',
  sessionStats = emptySessionStats()
}: TUpsertHiloGame) => {
  return HiloGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        channelId,
        messageId,
        gameId,
        activeBetId,
        betAmount,
        firstCard,
        remainingDeck,
        currentMultiplier,
        streak,
        houseEdgeSnapshot,
        showBalance,
        skipAnimations,
        status,
        sessionStats,
        idleNudgeSentAt: null
      }
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )
}

export const updateHiloGame = async ({
  userId,
  guildId,
  ...patch
}: TUpdateHiloGame) => {
  return HiloGame.findOneAndUpdate(
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

/** Claim WAITING → SETTLING so only one path settles the stake. */
export const claimHiloGameForSettle = async ({
  gameId,
  guildId
}: {
  gameId: string
  guildId: string
}) => {
  return HiloGame.findOneAndUpdate(
    { gameId, guildId, status: 'WAITING' },
    { $set: { status: 'SETTLING' } },
    { returnDocument: 'after' }
  )
}

export const deleteHiloGame = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  return HiloGame.deleteOne({ userId, guildId })
}

export const deleteHiloGameByGameId = async ({
  gameId,
  guildId
}: {
  gameId: string
  guildId: string
}) => {
  return HiloGame.deleteOne({ gameId, guildId })
}
