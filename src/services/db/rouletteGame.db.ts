import {
  rouletteIdleCloseMs,
  rouletteIdleNudgeThresholdMs
} from 'gambling-bot-shared/roulette'

import RouletteGame from '@/models/RouletteGame'

import {
  TGetRouletteGame,
  TUpdateRouletteGame,
  TUpsertRouletteGame
} from './rouletteGame.db.types'

export const getRouletteGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetRouletteGame) => {
  return RouletteGame.findOne({ userId, guildId })
}

export const getRouletteGameByGameId = async ({
  gameId,
  guildId
}: {
  gameId: string
  guildId: string
}) => {
  return RouletteGame.findOne({ gameId, guildId })
}

export const getRouletteGamesByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  return RouletteGame.find({ guildId })
}

export const getAllOldRouletteGames = async (days: number) => {
  return RouletteGame.find({
    updatedAt: {
      $lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }
  })
}

export const getRouletteGamesNeedingIdleNudge = async () => {
  const now = Date.now()

  return RouletteGame.find({
    updatedAt: {
      $lte: new Date(now - rouletteIdleNudgeThresholdMs()),
      $gt: new Date(now - rouletteIdleCloseMs())
    },
    $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
  })
}

export const markRouletteIdleNudgeSent = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  return RouletteGame.findOneAndUpdate(
    {
      userId,
      guildId,
      $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
    },
    { $set: { idleNudgeSentAt: new Date() } },
    { returnDocument: 'after' }
  )
}

export const upsertRouletteGame = async ({
  userId,
  guildId,
  channelId,
  messageId,
  gameId,
  showBalance,
  skipAnimations,
  phase = 'betting',
  bets = [],
  lastBets = [],
  lastSpinResult = null,
  lastNetResult = null,
  activeBetId = null,
  lockedAmount = null
}: TUpsertRouletteGame) => {
  return RouletteGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        channelId,
        messageId,
        gameId,
        showBalance,
        skipAnimations,
        phase,
        bets,
        lastBets,
        lastSpinResult,
        lastNetResult,
        activeBetId,
        lockedAmount,
        idleNudgeSentAt: null
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  )
}

export const updateRouletteGame = async ({
  userId,
  guildId,
  ...patch
}: TUpdateRouletteGame) => {
  return RouletteGame.findOneAndUpdate(
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

export const deleteRouletteGame = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  await RouletteGame.findOneAndDelete({ userId, guildId })
}
