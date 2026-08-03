import type { TBlackjackGame } from 'gambling-bot-shared/blackjack'
import {
  bumpSessionStats,
  normalizeSessionStats
} from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'

import { getUser, settleCasinoWinnings, updateBlackjackGame } from '@/services'
import { collectBlackjackBigWinLines } from '@/utils/casino/blackjackBigWin'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import { dealerDrawOne, dealerShouldDraw, resolveResult } from './engine'
import { blackjackFinalResultFromNet } from './netOutcome'
import { renderBlackjackEmbed, renderBlackjackResultComponents } from './render'
import {
  blackjackLockedTotal,
  computeBlackjackSidePayouts,
  sumHandBets
} from './sideBets'
import type { EngineState } from './types'

type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

/**
 * Finishes the dealer hand, settles the active round and parks the session in
 * `RESULT` so the player can rebet, change the stake, or close it.
 */
export const finishBlackjackDealerAndSettle = async ({
  game,
  engine,
  guildConfig,
  guild,
  sourceChannelId,
  showBalance,
  message,
  finalMessageContent,
  persistProgress
}: {
  game: TBlackjackGame
  engine: EngineState
  guildConfig?: TGuildConfiguration | null
  guild: AnnounceGuild
  sourceChannelId: string
  showBalance: boolean
  message?: EditableMessage | null
  finalMessageContent?: string
  persistProgress?: () => Promise<void>
}) => {
  while (dealerShouldDraw(engine)) {
    dealerDrawOne(engine)
    if (persistProgress) {
      await persistProgress()
    }
  }

  const blackjackSettings = guildConfig?.casinoSettings.blackjack
  const winMultipliers = blackjackSettings?.winMultipliers
  const pairsMultipliers = blackjackSettings?.pairsMultipliers
  const plusThreeMultipliers = blackjackSettings?.plusThreeMultipliers

  let mainPayout = 0
  for (let i = 0; i < engine.hands.length; i++) {
    const r = resolveResult(engine, i, winMultipliers)
    if (r.finished) mainPayout += r.payout
  }

  // Dealer natural was already peeked before PLAYER; insurance never pays here.
  const { pairsPayout, plusThreePayout, insurancePayout } =
    winMultipliers && pairsMultipliers && plusThreeMultipliers
      ? computeBlackjackSidePayouts({
          activePairsBetAmount: game.activePairsBetAmount,
          pairsOutcome: game.pairsOutcome,
          activePlusThreeBetAmount: game.activePlusThreeBetAmount,
          plusThreeOutcome: game.plusThreeOutcome,
          insuranceBetAmount: game.insuranceBetAmount,
          dealerHasBlackjack: false,
          winMultipliers,
          pairsMultipliers,
          plusThreeMultipliers
        })
      : { pairsPayout: 0, plusThreePayout: 0, insurancePayout: 0 }

  const totalPayout =
    mainPayout + pairsPayout + plusThreePayout + insurancePayout
  const totalBet = blackjackLockedTotal({
    hands: engine.hands,
    activePairsBetAmount: game.activePairsBetAmount,
    activePlusThreeBetAmount: game.activePlusThreeBetAmount,
    insuranceBetAmount: game.insuranceBetAmount
  })
  const net = totalPayout - totalBet
  const finalResultId = blackjackFinalResultFromNet(net)

  const betId = game.activeBetId
  const sessionStats = betId
    ? bumpSessionStats(normalizeSessionStats(game.sessionStats), {
        totalBet,
        totalPayout
      })
    : normalizeSessionStats(game.sessionStats)
  game.sessionStats = sessionStats

  if (betId) {
    await settleCasinoWinnings({
      userId: game.userId,
      guildId: game.guildId,
      totalBet,
      winnings: totalPayout,
      betId,
      game: 'blackjack',
      rounds: 1
    })
  }

  if (guildConfig && betId) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'blackjack',
      lines: collectBlackjackBigWinLines({
        engine,
        globalSettings: guildConfig.globalSettings,
        winMultipliers,
        minMultiplier:
          guildConfig.casinoSettings.winAnnouncements.blackjackMinMultiplier
      }),
      betId: game.gameId,
      sourceChannelId
    })
  }

  await updateBlackjackGame({
    userId: game.userId,
    guildId: game.guildId,
    phase: 'RESULT',
    activeBetId: null,
    activePairsBetAmount: null,
    activePlusThreeBetAmount: null,
    insuranceBetAmount: null,
    pairsOutcome: null,
    plusThreeOutcome: null,
    deck: engine.deck,
    deckIndex: engine.deckIndex,
    hands: engine.hands,
    activeHandIndex: -1,
    dealerCards: engine.dealerCards,
    sessionStats
  })

  let userBalance: number | undefined
  if (showBalance) {
    const user = await getUser({ userId: game.userId, guildId: game.guildId })
    if (user) userBalance = user.balance
  }

  if (message) {
    await message.edit({
      content: finalMessageContent,
      embeds: [
        renderBlackjackEmbed({
          userId: game.userId,
          guildId: game.guildId,
          gameId: game.gameId,
          hands: engine.hands,
          activeHandIndex: -1,
          dealerCards: engine.dealerCards,
          showBalance,
          userBalance,
          result: { kind: 'FINAL', finalResultId, netProfit: net },
          sideBets: {
            pairsBet: game.activePairsBetAmount,
            pairsOutcome: game.pairsOutcome,
            pairsPayout,
            plusThreeBet: game.activePlusThreeBetAmount,
            plusThreeOutcome: game.plusThreeOutcome,
            plusThreePayout,
            insuranceBet: game.insuranceBetAmount,
            insurancePayout
          },
          globalSettings: guildConfig?.globalSettings
        })
      ],
      components: renderBlackjackResultComponents({
        gameId: game.gameId,
        showBalance
      })
    } as never)
  }

  return {
    totalPayout,
    totalBet,
    mainHandsBet: sumHandBets(engine.hands),
    net,
    finalResultId,
    userBalance,
    sessionStats
  }
}
