import type { CasinoSessionStats } from 'gambling-bot-shared/casino'
import {
  bumpSessionStats,
  emptySessionStats,
  getBlackjackPayout,
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
import { DECK } from './deck'
import { calculateHandValue } from './math'
import {
  renderBlackjackButtons,
  renderBlackjackEmbed,
  renderBlackjackResultComponents
} from './render'
import type { StartBlackjackResultId } from './types'

type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

/**
 * Reserves a stake and deals one hand into an existing session document.
 * Naturals settle immediately and land in `RESULT`; everything else waits for
 * the player in `PLAYER`.
 */
export const startBlackjackHand = async ({
  userId,
  guildId,
  gameId,
  channelId,
  messageId,
  betAmount,
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
  showBalance: boolean
  skipAnimations?: boolean
  sessionStats?: CasinoSessionStats
  guildConfig: TGuildConfiguration
  guild: AnnounceGuild
  sourceChannelId: string
}) => {
  const betId = sessionBetId(gameId, sessionStats.roundsPlayed + 1)

  await reserveCasinoBet({
    userId,
    guildId,
    totalBet: betAmount,
    betId,
    game: 'blackjack',
    rounds: 1
  })

  const deck = shuffleDeck(DECK)
  const playerCards = [deck[0], deck[1]]
  const dealerCards = [deck[2], deck[3]]

  const playerHasBlackjack = calculateHandValue(playerCards) === 21
  const dealerHasBlackjack = calculateHandValue(dealerCards) === 21

  const { winMultipliers } = guildConfig.casinoSettings.blackjack

  if (playerHasBlackjack || dealerHasBlackjack) {
    let startResultId: StartBlackjackResultId
    let payout = 0

    if (playerHasBlackjack && dealerHasBlackjack) {
      startResultId = 'BBJ'
      payout = getBlackjackPayout(betAmount, 'push', winMultipliers)
    } else if (playerHasBlackjack) {
      startResultId = 'PBJ'
      payout = getBlackjackPayout(betAmount, 'blackjack', winMultipliers)
    } else {
      startResultId = 'DBJ'
      payout = 0
    }

    const finalBalance = await settleCasinoWinnings({
      userId,
      guildId,
      totalBet: betAmount,
      winnings: payout,
      betId,
      game: 'blackjack',
      rounds: 1
    })

    if (startResultId === 'PBJ') {
      const blackjackMultiplier = payout / betAmount
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
            `**x${blackjackMultiplier.toFixed(2)}** → **${formatMoney(payout, guildConfig.globalSettings)}** (bet **${formatMoney(betAmount, guildConfig.globalSettings)}**)`
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
      showBalance,
      skipAnimations,
      sessionStats: bumpSessionStats(sessionStats, {
        totalBet: betAmount,
        totalPayout: payout
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
          result: { kind: 'START', startResultId, payout },
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
