import {
  hiloGuessTimeoutMs,
  hiloIdleNudgeThresholdMs
} from 'gambling-bot-shared/casino'

import HiloGame from '@/models/HiloGame'

import type { TGetHiloGame, TUpsertHiloGame } from './hiloGame.db.types'

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

/** Waiting rounds past the guess timeout - worker applies timeout fee. */
export const getTimedOutHiloGames = async () => {
  return HiloGame.find({
    status: 'WAITING',
    createdAt: {
      $lte: new Date(Date.now() - hiloGuessTimeoutMs())
    }
  })
}

/** Waiting rounds idle long enough for a one-time DM reminder. */
export const getHiloGamesNeedingIdleNudge = async () => {
  const now = Date.now()

  return HiloGame.find({
    status: 'WAITING',
    createdAt: {
      $lte: new Date(now - hiloIdleNudgeThresholdMs()),
      $gt: new Date(now - hiloGuessTimeoutMs())
    },
    $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
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
  activeBetId,
  betAmount,
  firstCard,
  remainingDeck,
  houseEdgeSnapshot,
  timeoutFeeSnapshot,
  showBalance,
  status = 'WAITING'
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
        houseEdgeSnapshot,
        timeoutFeeSnapshot,
        showBalance,
        status,
        idleNudgeSentAt: null
      }
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
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
