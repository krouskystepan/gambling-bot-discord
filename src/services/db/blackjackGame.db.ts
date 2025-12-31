import BlackjackGame, { TBlackjackHand } from '@/models/BlackjackGame'
import { TGetBlackjackGame } from '@/types/types'

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

export const getAllOldBlackjackGames = async (days: number) => {
  return BlackjackGame.find({
    updatedAt: {
      $lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }
  })
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
  deck,
  deckIndex,
  hands,
  activeHandIndex,
  dealerCards
}: {
  userId: string
  guildId: string
  channelId: string
  messageId: string
  betId: string
  deck: unknown[]
  deckIndex: number
  hands: TBlackjackHand[]
  activeHandIndex: number
  dealerCards: unknown[]
}) => {
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
