import BlackjackGame from '@/models/BlackjackGame'
import { TGetBlackjackGame } from '@/types/types'
import { EngineState } from '@/utils/casino/blackjack'

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
  phase,
  dealerCards
}: {
  userId: string
  guildId: string
  channelId: string
  messageId: string
  betId: string
} & EngineState) => {
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
