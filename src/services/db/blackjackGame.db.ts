import {
  blackjackAutostandIdleMs,
  blackjackIdleNudgeThresholdMs
} from 'gambling-bot-shared/blackjack'
import { emptySessionStats } from 'gambling-bot-shared/casino'
import { DAY_MS } from 'gambling-bot-shared/common'

import BlackjackGame from '@/models/BlackjackGame'

import {
  TGetBlackjackGame,
  TUpdateBlackjackGame,
  TUpsertBlackjackGame
} from './blackjackGame.db.types'

/** Phases where a hand is live and can still be auto-finished. */
const MID_HAND_PHASES = ['PLAYER', 'DEALER'] as const

export const getBlackjackGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetBlackjackGame) => {
  return BlackjackGame.findOne({ userId, guildId })
}

export const getBlackjackGameByGameId = async ({
  gameId,
  guildId
}: {
  gameId: string
  guildId: string
}) => {
  return BlackjackGame.findOne({ gameId, guildId })
}

export const getBlackjackGamesByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  return BlackjackGame.find({ guildId })
}

/** Mid-hand games idle long enough for the auto-stand worker. */
export const getAllOldBlackjackGames = async (days: number) => {
  return BlackjackGame.find({
    phase: { $in: MID_HAND_PHASES },
    updatedAt: {
      $lte: new Date(Date.now() - days * DAY_MS)
    }
  })
}

/** Settled sessions idle long enough for the idle-close worker. */
export const getOldResultBlackjackGames = async (days: number) => {
  return BlackjackGame.find({
    phase: 'RESULT',
    updatedAt: {
      $lte: new Date(Date.now() - days * DAY_MS)
    }
  })
}

export const getBlackjackGamesNeedingIdleNudge = async () => {
  const now = Date.now()

  return BlackjackGame.find({
    updatedAt: {
      $lte: new Date(now - blackjackIdleNudgeThresholdMs()),
      $gt: new Date(now - blackjackAutostandIdleMs())
    },
    $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
  })
}

export const markBlackjackIdleNudgeSent = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  return BlackjackGame.findOneAndUpdate(
    {
      userId,
      guildId,
      $or: [{ idleNudgeSentAt: null }, { idleNudgeSentAt: { $exists: false } }]
    },
    { $set: { idleNudgeSentAt: new Date() } },
    { returnDocument: 'after' }
  )
}

export const saveBlackjackGame = async (
  game: typeof BlackjackGame.prototype
) => {
  game.idleNudgeSentAt = null
  await game.save()
}

export const updateBlackjackGame = async ({
  userId,
  guildId,
  ...patch
}: TUpdateBlackjackGame) => {
  return BlackjackGame.findOneAndUpdate(
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

export const upsertBlackjackGame = async ({
  userId,
  guildId,
  channelId,
  messageId,
  gameId,
  activeBetId = null,
  baseBetAmount,
  showBalance,
  skipAnimations = false,
  sessionStats,
  deck,
  deckIndex,
  hands,
  activeHandIndex,
  phase,
  dealerCards
}: TUpsertBlackjackGame) => {
  return BlackjackGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        channelId,
        messageId,
        gameId,
        activeBetId,
        baseBetAmount,
        showBalance,
        skipAnimations,
        sessionStats: sessionStats ?? emptySessionStats(),
        deck,
        deckIndex,
        hands,
        activeHandIndex,
        phase,
        dealerCards,
        idleNudgeSentAt: null
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  )
}

export const deleteBlackjackGame = async ({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) => {
  await BlackjackGame.findOneAndDelete({ userId, guildId })
}

export const getStaleDealerBlackjackGames = async (graceMs: number) => {
  const cutoff = new Date(Date.now() - graceMs)

  return BlackjackGame.find({
    phase: 'DEALER',
    updatedAt: { $lte: cutoff }
  })
}
