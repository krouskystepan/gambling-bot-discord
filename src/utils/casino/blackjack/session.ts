import type {
  CasinoSessionStats,
  PerfectPairsOutcome,
  PlusThreeOutcome
} from 'gambling-bot-shared/casino'
import {
  bumpSessionStats,
  classifyPerfectPairs,
  classifyTwentyOnePlusThree,
  emptySessionStats,
  getBlackjackPayout,
  isBlackjackInsuranceEnabled,
  isBlackjackPairsEnabled,
  isBlackjackPlusThreeEnabled,
  normalizeBlackjackDeckCount,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney, sessionBetId } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'

import {
  reserveCasinoBet,
  settleCasinoWinnings,
  upsertBlackjackGame
} from '@/services'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import { shuffleDeck } from '../rng'
import { createDeck } from './deck'
import { calculateHandValue } from './math'
import {
  renderBlackjackButtons,
  renderBlackjackEmbed,
  renderBlackjackInsuranceComponents,
  renderBlackjackResultComponents
} from './render'
import { blackjackLockedTotal, computeBlackjackSidePayouts } from './sideBets'
import type { StartBlackjackResultId } from './types'

type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

type DealtHandContext = {
  userId: string
  guildId: string
  gameId: string
  channelId: string
  messageId: string
  betAmount: number
  pairsBetAmount: number
  pairsOutcome: PerfectPairsOutcome
  plusThreeBetAmount: number
  plusThreeOutcome: PlusThreeOutcome
  insuranceBetAmount: number | null
  showBalance: boolean
  skipAnimations: boolean
  sessionStats: CasinoSessionStats
  deck: ReturnType<typeof shuffleDeck>
  playerCards: ReturnType<typeof shuffleDeck>
  dealerCards: ReturnType<typeof shuffleDeck>
  betId: string
  guildConfig: TGuildConfiguration
  guild: AnnounceGuild
  sourceChannelId: string
}

const sideBetSummary = ({
  pairsBetAmount,
  pairsOutcome,
  pairsPayout,
  plusThreeBetAmount,
  plusThreeOutcome,
  plusThreePayout,
  insuranceBetAmount,
  insurancePayout
}: {
  pairsBetAmount: number
  pairsOutcome: PerfectPairsOutcome
  pairsPayout?: number
  plusThreeBetAmount: number
  plusThreeOutcome: PlusThreeOutcome
  plusThreePayout?: number
  insuranceBetAmount: number | null
  insurancePayout?: number
}) => ({
  pairsBet: pairsBetAmount > 0 ? pairsBetAmount : null,
  pairsOutcome: pairsBetAmount > 0 ? pairsOutcome : null,
  pairsPayout,
  plusThreeBet: plusThreeBetAmount > 0 ? plusThreeBetAmount : null,
  plusThreeOutcome: plusThreeBetAmount > 0 ? plusThreeOutcome : null,
  plusThreePayout,
  insuranceBet: insuranceBetAmount,
  insurancePayout
})

/**
 * After cards are dealt (and optional insurance decided), settle naturals or
 * open the player turn. Both dealer cards are already known server-side.
 */
export const resolveBlackjackAfterPeek = async ({
  userId,
  guildId,
  gameId,
  channelId,
  messageId,
  betAmount,
  pairsBetAmount,
  pairsOutcome,
  plusThreeBetAmount,
  plusThreeOutcome,
  insuranceBetAmount,
  showBalance,
  skipAnimations,
  sessionStats,
  deck,
  playerCards,
  dealerCards,
  betId,
  guildConfig,
  guild,
  sourceChannelId
}: DealtHandContext) => {
  const playerHasBlackjack = calculateHandValue(playerCards) === 21
  const dealerHasBlackjack = calculateHandValue(dealerCards) === 21
  const { winMultipliers, pairsMultipliers, plusThreeMultipliers } =
    guildConfig.casinoSettings.blackjack

  const { pairsPayout, plusThreePayout, insurancePayout } =
    computeBlackjackSidePayouts({
      activePairsBetAmount: pairsBetAmount,
      pairsOutcome,
      activePlusThreeBetAmount: plusThreeBetAmount,
      plusThreeOutcome,
      insuranceBetAmount,
      dealerHasBlackjack,
      winMultipliers,
      pairsMultipliers,
      plusThreeMultipliers
    })

  if (playerHasBlackjack || dealerHasBlackjack) {
    let startResultId: StartBlackjackResultId
    let mainPayout = 0

    if (playerHasBlackjack && dealerHasBlackjack) {
      startResultId = 'BBJ'
      mainPayout = getBlackjackPayout(betAmount, 'push', winMultipliers)
    } else if (playerHasBlackjack) {
      startResultId = 'PBJ'
      mainPayout = getBlackjackPayout(betAmount, 'blackjack', winMultipliers)
    } else {
      startResultId = 'DBJ'
      mainPayout = 0
    }

    const totalPayout =
      mainPayout + pairsPayout + plusThreePayout + insurancePayout
    const totalBet = blackjackLockedTotal({
      hands: [
        { betAmount, cards: playerCards, finished: true, isSplitHand: false }
      ],
      activePairsBetAmount: pairsBetAmount,
      activePlusThreeBetAmount: plusThreeBetAmount,
      insuranceBetAmount
    })

    const finalBalance = await settleCasinoWinnings({
      userId,
      guildId,
      totalBet,
      winnings: totalPayout,
      betId,
      game: 'blackjack',
      rounds: 1
    })

    if (startResultId === 'PBJ' && betAmount > 0) {
      const blackjackMultiplier = mainPayout / betAmount
      if (
        shouldAnnounceByMultiplier(
          blackjackMultiplier,
          guildConfig.casinoSettings.winAnnouncements.blackjackMinMultiplier
        )
      ) {
        tryAnnounceBigWin({
          guild,
          guildConfig,
          game: 'blackjack',
          lines: [
            `**x${blackjackMultiplier.toFixed(2)}** → **${formatMoney(mainPayout, guildConfig.globalSettings)}** (bet **${formatMoney(betAmount, guildConfig.globalSettings)}**)`
          ],
          betId: gameId,
          sourceChannelId
        })
      }
    }

    const hands = [
      {
        cards: playerCards,
        betAmount,
        finished: true,
        isSplitHand: false
      }
    ]

    await upsertBlackjackGame({
      userId,
      guildId,
      channelId,
      messageId,
      gameId,
      activeBetId: null,
      baseBetAmount: betAmount,
      basePairsBetAmount: pairsBetAmount > 0 ? pairsBetAmount : null,
      activePairsBetAmount: null,
      basePlusThreeBetAmount:
        plusThreeBetAmount > 0 ? plusThreeBetAmount : null,
      activePlusThreeBetAmount: null,
      insuranceBetAmount: null,
      pairsOutcome: null,
      plusThreeOutcome: null,
      showBalance,
      skipAnimations,
      sessionStats: bumpSessionStats(sessionStats, {
        totalBet,
        totalPayout
      }),
      deck,
      deckIndex: 4,
      hands,
      activeHandIndex: -1,
      phase: 'RESULT',
      dealerCards
    })

    return {
      phase: 'RESULT' as const,
      embeds: [
        renderBlackjackEmbed({
          userId,
          guildId,
          gameId,
          hands,
          activeHandIndex: -1,
          dealerCards,
          showBalance,
          userBalance: finalBalance,
          result: {
            kind: 'START',
            startResultId,
            payout: totalPayout,
            totalBet
          },
          sideBets: sideBetSummary({
            pairsBetAmount,
            pairsOutcome,
            pairsPayout,
            plusThreeBetAmount,
            plusThreeOutcome,
            plusThreePayout,
            insuranceBetAmount,
            insurancePayout
          }),
          globalSettings: guildConfig.globalSettings
        })
      ],
      components: renderBlackjackResultComponents({ gameId, showBalance })
    }
  }

  const hands = [
    {
      cards: playerCards,
      betAmount,
      finished: false,
      isSplitHand: false
    }
  ]

  await upsertBlackjackGame({
    userId,
    guildId,
    channelId,
    messageId,
    gameId,
    activeBetId: betId,
    baseBetAmount: betAmount,
    basePairsBetAmount: pairsBetAmount > 0 ? pairsBetAmount : null,
    activePairsBetAmount: pairsBetAmount > 0 ? pairsBetAmount : null,
    basePlusThreeBetAmount: plusThreeBetAmount > 0 ? plusThreeBetAmount : null,
    activePlusThreeBetAmount:
      plusThreeBetAmount > 0 ? plusThreeBetAmount : null,
    insuranceBetAmount,
    pairsOutcome: pairsBetAmount > 0 ? pairsOutcome : null,
    plusThreeOutcome: plusThreeBetAmount > 0 ? plusThreeOutcome : null,
    showBalance,
    skipAnimations,
    sessionStats,
    deck,
    deckIndex: 4,
    hands,
    activeHandIndex: 0,
    phase: 'PLAYER',
    dealerCards
  })

  return {
    phase: 'PLAYER' as const,
    embeds: [
      renderBlackjackEmbed({
        userId,
        guildId,
        gameId,
        hands,
        activeHandIndex: 0,
        dealerCards,
        showBalance,
        dealerHideSecondCard: true,
        result: { kind: 'PHASE', gamePhaseId: 'PLAYER_TURN' },
        sideBets: sideBetSummary({
          pairsBetAmount,
          pairsOutcome,
          plusThreeBetAmount,
          plusThreeOutcome,
          insuranceBetAmount
        }),
        globalSettings: guildConfig.globalSettings
      })
    ],
    components: [
      renderBlackjackButtons({
        gameId,
        showBalance,
        canDouble: true,
        canSplit: playerCards[0].label === playerCards[1].label
      })
    ]
  }
}

/**
 * Reserves main (+ optional pairs / 21+3), deals one hand, and either offers
 * insurance (Ace up), settles naturals, or waits for the player.
 */
export const startBlackjackHand = async ({
  userId,
  guildId,
  gameId,
  channelId,
  messageId,
  betAmount,
  pairsBetAmount = 0,
  plusThreeBetAmount = 0,
  showBalance,
  skipAnimations = false,
  sessionStats = emptySessionStats(),
  guildConfig,
  guild,
  sourceChannelId
}: {
  userId: string
  guildId: string
  gameId: string
  channelId: string
  messageId: string
  betAmount: number
  pairsBetAmount?: number
  plusThreeBetAmount?: number
  showBalance: boolean
  skipAnimations?: boolean
  sessionStats?: CasinoSessionStats
  guildConfig: TGuildConfiguration
  guild: AnnounceGuild
  sourceChannelId: string
}) => {
  const blackjackSettings = guildConfig.casinoSettings.blackjack
  const pairsStake = isBlackjackPairsEnabled(blackjackSettings.pairsMultipliers)
    ? Math.max(0, pairsBetAmount)
    : 0
  const plusThreeStake = isBlackjackPlusThreeEnabled(
    blackjackSettings.plusThreeMultipliers
  )
    ? Math.max(0, plusThreeBetAmount)
    : 0
  const betId = sessionBetId(gameId, sessionStats.roundsPlayed + 1)

  await reserveCasinoBet({
    userId,
    guildId,
    totalBet: betAmount + pairsStake + plusThreeStake,
    betId,
    game: 'blackjack',
    rounds: 1
  })

  const deckCount = normalizeBlackjackDeckCount(
    guildConfig.casinoSettings.blackjack.deckCount
  )
  const deck = shuffleDeck(createDeck(deckCount))
  const playerCards = [deck[0], deck[1]]
  const dealerCards = [deck[2], deck[3]]
  const pairsOutcome = classifyPerfectPairs(playerCards[0], playerCards[1])
  const plusThreeOutcome = classifyTwentyOnePlusThree(
    playerCards[0],
    playerCards[1],
    dealerCards[0]
  )

  const dealt: DealtHandContext = {
    userId,
    guildId,
    gameId,
    channelId,
    messageId,
    betAmount,
    pairsBetAmount: pairsStake,
    pairsOutcome,
    plusThreeBetAmount: plusThreeStake,
    plusThreeOutcome,
    insuranceBetAmount: null,
    showBalance,
    skipAnimations,
    sessionStats,
    deck,
    playerCards,
    dealerCards,
    betId,
    guildConfig,
    guild,
    sourceChannelId
  }

  // Ace up: offer insurance before peeking / settling naturals (if enabled).
  if (
    dealerCards[0].label === 'A' &&
    isBlackjackInsuranceEnabled(blackjackSettings.winMultipliers)
  ) {
    const hands = [
      {
        cards: playerCards,
        betAmount,
        finished: false,
        isSplitHand: false
      }
    ]

    await upsertBlackjackGame({
      userId,
      guildId,
      channelId,
      messageId,
      gameId,
      activeBetId: betId,
      baseBetAmount: betAmount,
      basePairsBetAmount: pairsStake > 0 ? pairsStake : null,
      activePairsBetAmount: pairsStake > 0 ? pairsStake : null,
      basePlusThreeBetAmount: plusThreeStake > 0 ? plusThreeStake : null,
      activePlusThreeBetAmount: plusThreeStake > 0 ? plusThreeStake : null,
      insuranceBetAmount: null,
      pairsOutcome: pairsStake > 0 ? pairsOutcome : null,
      plusThreeOutcome: plusThreeStake > 0 ? plusThreeOutcome : null,
      showBalance,
      skipAnimations,
      sessionStats,
      deck,
      deckIndex: 4,
      hands,
      activeHandIndex: 0,
      phase: 'INSURANCE',
      dealerCards
    })

    return {
      phase: 'INSURANCE' as const,
      embeds: [
        renderBlackjackEmbed({
          userId,
          guildId,
          gameId,
          hands,
          activeHandIndex: 0,
          dealerCards,
          showBalance,
          dealerHideSecondCard: true,
          result: { kind: 'PHASE', gamePhaseId: 'INSURANCE_OFFER' },
          sideBets: sideBetSummary({
            pairsBetAmount: pairsStake,
            pairsOutcome,
            plusThreeBetAmount: plusThreeStake,
            plusThreeOutcome,
            insuranceBetAmount: null
          }),
          globalSettings: guildConfig.globalSettings
        })
      ],
      components: renderBlackjackInsuranceComponents({ gameId, showBalance })
    }
  }

  return resolveBlackjackAfterPeek(dealt)
}
