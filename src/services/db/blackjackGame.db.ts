import BlackjackGame from '@/models/BlackjackGame'
import { TGetBlackjackGame, TUpsertBlackjackGame } from '@/types/types'
import { Card } from '@/utils/blackjackUtils'

export const getBlackjackGameByUserAndGuild = async ({
  userId,
  guildId
}: TGetBlackjackGame) => {
  return await BlackjackGame.findOne({ userId, guildId })
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

export const upsertBlackjackGame = async ({
  userId,
  guildId,
  gameId,
  betAmount,
  deck,
  playerCards,
  dealerCards
}: TUpsertBlackjackGame) => {
  return BlackjackGame.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        gameId,
        betAmount,
        deck,
        playerCards,
        dealerCards
      }
    },
    { upsert: true, new: true }
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
