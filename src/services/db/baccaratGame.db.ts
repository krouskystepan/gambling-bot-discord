import {
  baccaratIdleCloseMs,
  baccaratIdleNudgeThresholdMs
} from 'gambling-bot-shared/baccarat'
import { emptySessionStats } from 'gambling-bot-shared/casino'
import { DAY_MS } from 'gambling-bot-shared/common'

import BaccaratGame from '@/models/BaccaratGame'

import {
  TGetBaccaratGame,
  TUpdateBaccaratGame,
  TUpsertBaccaratGame
} from './baccaratGame.db.types'

export const getBaccaratGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetBaccaratGame) => {
  return BaccaratGame.findOne({ userId, guildId })
}

export const getBaccaratGameByGameId = async ({
  gameId,
  guildId
}: {
  gameId: string
  guildId: string
}) => {
  return BaccaratGame.findOne({ gameId, guildId })
}

export const getBaccaratGamesByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  return BaccaratGame.find({ guildId })
}

/** Idle sessions (waiting or settled) for the idle-close worker. */
export const getAllOldBaccaratGames = async (days: number) => {
  return BaccaratGame.find({
    phase: { $in: ['waiting', 'result'] },
    updatedAt: {
      $lte: new Date(Date.now() - days * DAY_MS)
    }
  })
}

export const getBaccaratGamesNeedingIdleNudge = async () => {
  const now = Date.now()

  return BaccaratGame.find({
    phase: { $in: ['waiting', 'result'] },
    updatedAt: {
      $lte: new Date(now - baccaratIdleNudgeThresholdMs()),
      $gt: new Date(now - baccaratIdleCloseMs())
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
  gameId,
  activeBetId = null,
  betAmount,
  lastSide = null,
  showBalance,
  skipAnimations,
  phase = 'waiting',
  pendingDeal = null,
  sessionStats
}: TUpsertBaccaratGame) => {
  return BaccaratGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        channelId,
        messageId,
        gameId,
        activeBetId,
        betAmount,
        lastSide,
        showBalance,
        skipAnimations,
        phase,
        pendingDeal,
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

export const deleteBaccaratGame = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  await BaccaratGame.findOneAndDelete({ userId, guildId })
}

export const updateBaccaratGame = async ({
  userId,
  guildId,
  ...patch
}: TUpdateBaccaratGame) => {
  return BaccaratGame.findOneAndUpdate(
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

export const getStaleDealingBaccaratGames = async (graceMs: number) => {
  const cutoff = new Date(Date.now() - graceMs)

  return BaccaratGame.find({
    phase: 'dealing',
    updatedAt: { $lte: cutoff }
  })
}
