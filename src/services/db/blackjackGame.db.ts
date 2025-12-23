import BlackjackGame from '@/models/BlackjackGame'
import { TGetBlackjackGame, TUpsertBlackjackGame } from '@/types/types'
import { Card } from '@/utils/casino/blackjack'

export const getBlackjackGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetBlackjackGame) => {
  return await BlackjackGame.findOne({ userId, guildId })
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

export const getAllOldBlackjackGames = async (days: number) => {
  return BlackjackGame.find({
    updatedAt: {
      $lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }
  })
}

export const updateBlackjackGameState = async ({
  userId,
  guildId,
  playerCards,
  deck
}: {
  userId: string
  guildId: string
  playerCards: Card[]
  deck: Card[]
}) => {
  await BlackjackGame.findOneAndUpdate(
    { userId, guildId },
    { playerCards, deck }
  )
}

export const updateBlackjackGame = async (
  game: typeof BlackjackGame.prototype
) => {
  await game.save()
}

export const upsertBlackjackGame = async ({
  userId,
  guildId,
  channelId,
  messageId,
  betId,
  betAmount,
  deck,
  deckIndex,
  playerCards,
  dealerCards
}: TUpsertBlackjackGame) => {
  return BlackjackGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        channelId,
        messageId,
        betId,
        betAmount,
        deck,
        deckIndex,
        playerCards,
        dealerCards
      }
    },
    {
      upsert: true,
      new: true
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
