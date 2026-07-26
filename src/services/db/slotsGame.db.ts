import {
  slotsIdleCloseMs,
  slotsIdleNudgeThresholdMs
} from 'gambling-bot-shared/slots'

import SlotsGame from '@/models/SlotsGame'

import {
  TGetSlotsGame,
  TUpdateSlotsGame,
  TUpsertSlotsGame
} from './slotsGame.db.types'

export const getSlotsGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetSlotsGame) => {
  return SlotsGame.findOne({ userId, guildId })
}

export const getSlotsGameByGameId = async ({
  gameId,
  guildId
}: {
  gameId: string
  guildId: string
}) => {
  return SlotsGame.findOne({ gameId, guildId })
}

export const getSlotsGamesByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  return SlotsGame.find({ guildId })
}

export const getAllOldSlotsGames = async (days: number) => {
  return SlotsGame.find({
    updatedAt: {
      $lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }
  })
}

export const getSlotsGamesNeedingIdleNudge = async () => {
  const now = Date.now()

  return SlotsGame.find({
    updatedAt: {
      $lte: new Date(now - slotsIdleNudgeThresholdMs()),
      $gt: new Date(now - slotsIdleCloseMs())
    },
    $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
  })
}

export const markSlotsIdleNudgeSent = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  return SlotsGame.findOneAndUpdate(
    {
      userId,
      guildId,
      $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
    },
    { $set: { idleNudgeSentAt: new Date() } },
    { returnDocument: 'after' }
  )
}

export const upsertSlotsGame = async ({
  userId,
  guildId,
  channelId,
  messageId,
  gameId,
  showBalance,
  skipAnimations,
  unitBet = null,
  spinsCount = 1,
  phase = 'ready',
  lastReels = null,
  lastNetResult = null,
  lastSpinsCount = null,
  lastTotalBet = null,
  lastWinsCount = null,
  activeBetId = null,
  lockedAmount = null
}: TUpsertSlotsGame) => {
  return SlotsGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        channelId,
        messageId,
        gameId,
        showBalance,
        skipAnimations,
        unitBet,
        spinsCount,
        phase,
        lastReels,
        lastNetResult,
        lastSpinsCount,
        lastTotalBet,
        lastWinsCount,
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

export const updateSlotsGame = async ({
  userId,
  guildId,
  ...patch
}: TUpdateSlotsGame) => {
  return SlotsGame.findOneAndUpdate(
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

export const deleteSlotsGame = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  await SlotsGame.findOneAndDelete({ userId, guildId })
}
