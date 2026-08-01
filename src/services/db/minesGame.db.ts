import { emptySessionStats } from 'gambling-bot-shared/casino'
import { DAY_MS } from 'gambling-bot-shared/common'
import {
  minesAutoResolveIdleMs,
  minesIdleNudgeThresholdMs
} from 'gambling-bot-shared/mines'

import MinesGame from '@/models/MinesGame'

import {
  TGetMinesGame,
  TUpdateMinesGame,
  TUpsertMinesGame
} from './minesGame.db.types'

export const getMinesGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetMinesGame) => {
  return MinesGame.findOne({ userId, guildId })
}

export const getMinesGameByGameId = async ({
  gameId,
  guildId
}: {
  gameId: string
  guildId: string
}) => {
  return MinesGame.findOne({ gameId, guildId })
}

export const getMinesGamesByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  return MinesGame.find({ guildId })
}

/** Live boards idle long enough for the auto-resolve worker. */
export const getAllOldMinesGames = async (days: number) => {
  return MinesGame.find({
    status: 'ACTIVE',
    updatedAt: {
      $lte: new Date(Date.now() - days * DAY_MS)
    }
  })
}

/** Settled or empty tables idle long enough for the idle-close worker. */
export const getOldResultMinesGames = async (days: number) => {
  return MinesGame.find({
    status: { $in: ['RESULT', 'SETUP'] },
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

export const saveMinesGame = async (game: typeof MinesGame.prototype) => {
  game.idleNudgeSentAt = null
  await game.save()
}

export const updateMinesGame = async ({
  userId,
  guildId,
  ...patch
}: TUpdateMinesGame) => {
  return MinesGame.findOneAndUpdate(
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

export const upsertMinesGame = async ({
  userId,
  guildId,
  channelId,
  messageId,
  gameId,
  activeBetId = null,
  betAmount,
  mineCount,
  mineIndices,
  revealedIndices,
  houseEdgeSnapshot,
  status,
  showBalance = false,
  sessionStats
}: TUpsertMinesGame) => {
  return MinesGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        channelId,
        messageId,
        gameId,
        activeBetId,
        betAmount,
        mineCount,
        mineIndices,
        revealedIndices,
        houseEdgeSnapshot,
        status,
        showBalance,
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

export const deleteMinesGame = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  await MinesGame.findOneAndDelete({ userId, guildId })
}

/** Boards marked RESULT whose settlement never completed (crash mid-finish). */
export const getStaleSettlingMinesGames = async (graceMs: number) => {
  const cutoff = new Date(Date.now() - graceMs)

  return MinesGame.find({
    status: 'RESULT',
    activeBetId: { $ne: null },
    updatedAt: { $lte: cutoff }
  })
}
