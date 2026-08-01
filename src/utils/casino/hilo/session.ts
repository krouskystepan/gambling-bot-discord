import type { CasinoSessionStats } from 'gambling-bot-shared/casino'
import {
  emptySessionStats,
  getHiloWinMultiplier
} from 'gambling-bot-shared/casino'
import { sessionBetId } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'

import { reserveCasinoBet, upsertHiloGame } from '@/services'
import {
  createShuffledHiloDeck,
  drawHiloCard,
  formatHiloCard
} from '@/utils/casino/rng'

import { renderHiloGuessComponents, renderHiloPromptEmbed } from './render'

type MoneySettings = Partial<GlobalSettings> | null | undefined

/** Reserves the stake and deals the first card into an existing session. */
export const startHiloRound = async ({
  userId,
  guildId,
  gameId,
  channelId,
  messageId,
  betAmount,
  houseEdge,
  showBalance,
  sessionStats = emptySessionStats(),
  globalSettings
}: {
  userId: string
  guildId: string
  gameId: string
  channelId: string
  messageId: string
  betAmount: number
  houseEdge: number
  showBalance: boolean
  sessionStats?: CasinoSessionStats
  globalSettings: MoneySettings
}) => {
  const betId = sessionBetId(gameId, sessionStats.roundsPlayed + 1)

  await reserveCasinoBet({
    userId,
    guildId,
    totalBet: betAmount,
    betId,
    game: 'hilo',
    rounds: 1
  })

  const deck = createShuffledHiloDeck()
  const first = drawHiloCard(deck)
  const firstCard = formatHiloCard(first)
  const higherMult = getHiloWinMultiplier(first.rank, 'higher', houseEdge)
  const lowerMult = getHiloWinMultiplier(first.rank, 'lower', houseEdge)
  const sameMult = getHiloWinMultiplier(first.rank, 'same', houseEdge)

  await upsertHiloGame({
    userId,
    guildId,
    channelId,
    messageId,
    gameId,
    activeBetId: betId,
    betAmount,
    firstCard: first,
    remainingDeck: deck,
    houseEdgeSnapshot: houseEdge,
    showBalance,
    status: 'WAITING',
    sessionStats
  })

  return {
    embeds: [
      renderHiloPromptEmbed({
        firstCard,
        higherMult,
        lowerMult,
        sameMult,
        bet: betAmount,
        betId: gameId,
        globalSettings
      })
    ],
    components: renderHiloGuessComponents({
      gameId,
      firstRank: first.rank,
      houseEdge
    })
  }
}
