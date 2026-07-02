import {
  blackjackAutostandIdleMs,
  blackjackIdleNudgeThresholdMs
} from 'gambling-bot-shared/blackjack'

import BlackjackGame from '@/models/BlackjackGame'
import { TGetBlackjackGame, TUpsertBlackjackGame } from '@/types/types'

export const getBlackjackGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetBlackjackGame) => {
  return BlackjackGame.findOne({ userId, guildId })
}

export const getBlackjackGameByBetId = async ({
  betId,
  guildId
}: {
  betId: string
  guildId: string
}) => {
  return BlackjackGame.findOne({ betId, guildId })
}

export const getBlackjackGamesByGuildId = async ({
  guildId
}: {
  guildId: string
}) => {
  return BlackjackGame.find({ guildId })
}

export const getAllOldBlackjackGames = async (days: number) => {
  return BlackjackGame.find({
    updatedAt: {
      $lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
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

export const updateBlackjackGame = async (
  game: typeof BlackjackGame.prototype
) => {
  game.idleNudgeSentAt = null
  await game.save()
}

export const upsertBlackjackGame = async ({
  userId,
  guildId,
  channelId,
  messageId,
  betId,
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
        betId,
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
