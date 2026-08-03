import type { TBlackjackGame } from 'gambling-bot-shared/blackjack'
import {
  classifyPerfectPairs,
  classifyTwentyOnePlusThree,
  normalizeSessionStats
} from 'gambling-bot-shared/casino'
import { sessionBetId } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'

import { reserveCasinoBet, updateBlackjackGame } from '@/services'

import { resolveBlackjackAfterPeek } from './session'

type AnnounceGuild = Parameters<typeof resolveBlackjackAfterPeek>[0]['guild']

/**
 * Accept or decline insurance, then peek / settle naturals or enter PLAYER.
 * Used by button handlers and the idle auto-finish worker.
 */
export const resolveBlackjackInsuranceDecision = async ({
  game,
  takeInsurance,
  guildConfig,
  guild,
  sourceChannelId,
  showBalance
}: {
  game: TBlackjackGame
  takeInsurance: boolean
  guildConfig: TGuildConfiguration
  guild: AnnounceGuild
  sourceChannelId: string
  showBalance: boolean
}) => {
  const betId = game.activeBetId
  if (!betId) {
    throw new Error('MISSING_ACTIVE_BET')
  }

  const mainHand = game.hands[0]
  if (!mainHand || mainHand.cards.length < 2 || game.dealerCards.length < 2) {
    throw new Error('INVALID_INSURANCE_STATE')
  }

  const mainBet = mainHand.betAmount
  let insuranceBetAmount: number | null = null

  if (takeInsurance) {
    const halfMain = mainBet / 2
    await reserveCasinoBet({
      userId: game.userId,
      guildId: game.guildId,
      totalBet: halfMain,
      betId: sessionBetId(betId, 'ins'),
      game: 'blackjack'
    })
    insuranceBetAmount = halfMain

    await updateBlackjackGame({
      userId: game.userId,
      guildId: game.guildId,
      insuranceBetAmount
    })
  }

  const pairsBetAmount = game.activePairsBetAmount ?? 0
  const pairsOutcome =
    game.pairsOutcome ??
    classifyPerfectPairs(mainHand.cards[0], mainHand.cards[1])

  const plusThreeBetAmount = game.activePlusThreeBetAmount ?? 0
  const plusThreeOutcome =
    game.plusThreeOutcome ??
    classifyTwentyOnePlusThree(
      mainHand.cards[0],
      mainHand.cards[1],
      game.dealerCards[0]
    )

  return resolveBlackjackAfterPeek({
    userId: game.userId,
    guildId: game.guildId,
    gameId: game.gameId,
    channelId: game.channelId,
    messageId: game.messageId,
    betAmount: mainBet,
    pairsBetAmount,
    pairsOutcome,
    plusThreeBetAmount,
    plusThreeOutcome,
    insuranceBetAmount,
    showBalance,
    skipAnimations: game.skipAnimations,
    sessionStats: normalizeSessionStats(game.sessionStats),
    deck: game.deck,
    playerCards: mainHand.cards,
    dealerCards: game.dealerCards,
    betId,
    guildConfig,
    guild,
    sourceChannelId
  })
}
