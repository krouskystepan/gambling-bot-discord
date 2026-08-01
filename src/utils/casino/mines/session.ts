import type { CasinoSessionStats } from 'gambling-bot-shared/casino'
import { emptySessionStats } from 'gambling-bot-shared/casino'
import { sessionBetId } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'
import {
  createMinesEngine,
  currentMinesMultiplier
} from 'gambling-bot-shared/mines'

import { reserveCasinoBet, upsertMinesGame } from '@/services'

import { renderMinesButtons, renderMinesEmbed } from './render'

type MoneySettings = Partial<GlobalSettings> | null | undefined

/** Reserves the stake and deals a fresh board into an existing session. */
export const startMinesBoard = async ({
  userId,
  guildId,
  gameId,
  channelId,
  messageId,
  betAmount,
  mineCount,
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
  mineCount: number
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
    game: 'mines',
    rounds: 1
  })

  const engine = createMinesEngine({
    betAmount,
    mineCount,
    houseEdgeSnapshot: houseEdge
  })

  await upsertMinesGame({
    userId,
    guildId,
    channelId,
    messageId,
    gameId,
    activeBetId: betId,
    betAmount: engine.betAmount,
    mineCount: engine.mineCount,
    mineIndices: engine.mineIndices,
    revealedIndices: engine.revealedIndices,
    houseEdgeSnapshot: engine.houseEdgeSnapshot,
    status: engine.status,
    showBalance,
    sessionStats
  })

  return {
    embeds: [
      renderMinesEmbed({
        gameId,
        betAmount: engine.betAmount,
        mineCount: engine.mineCount,
        revealedCount: 0,
        multiplier: currentMinesMultiplier(engine),
        result: { kind: 'ACTIVE' },
        showBalance,
        globalSettings
      })
    ],
    components: renderMinesButtons({ gameId, state: engine, showBalance })
  }
}
