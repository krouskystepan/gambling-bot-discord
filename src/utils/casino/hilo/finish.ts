import {
  type HiloGuess,
  type THiloGame,
  getHiloTimeoutRefund,
  getHiloWinMultiplier,
  resolveHiloRound,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'

import {
  claimHiloGameForSettle,
  deleteHiloGame,
  getUser,
  settleCasinoWinnings
} from '@/services'
import type { HiloCard } from '@/utils/casino/rng'
import { drawHiloCard, formatHiloCard } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import {
  renderHiloResultEmbed,
  renderHiloRevealEmbed,
  renderHiloTimeoutEmbed
} from './render'

type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

/** Copy card fields explicitly - mongoose subdocs do not spread via `{...card}`. */
const toHiloCard = (card: THiloGame['firstCard']): HiloCard => ({
  label: card.label,
  suite: card.suite,
  rank: card.rank
})

const toMutableDeck = (game: THiloGame): HiloCard[] =>
  game.remainingDeck.map(toHiloCard)

const formatStoredCard = (card: THiloGame['firstCard']) =>
  formatHiloCard(toHiloCard(card))

export const settleHiloGuess = async ({
  game,
  guess,
  guildConfig,
  guild,
  sourceChannelId,
  message
}: {
  game: THiloGame
  guess: HiloGuess
  guildConfig: TGuildConfiguration
  guild: AnnounceGuild
  sourceChannelId: string
  message?: EditableMessage | null
}) => {
  const claimed = await claimHiloGameForSettle({
    gameId: game.gameId,
    guildId: game.guildId
  })
  if (!claimed) return null

  const firstCard = formatStoredCard(claimed.firstCard)
  const winMultiplier = getHiloWinMultiplier(
    claimed.firstCard.rank,
    guess,
    claimed.houseEdgeSnapshot
  )

  if (winMultiplier == null) {
    await settleCasinoWinnings({
      userId: claimed.userId,
      guildId: claimed.guildId,
      totalBet: claimed.betAmount,
      winnings: claimed.betAmount,
      betId: claimed.activeBetId,
      game: 'hilo',
      rounds: 1
    })
    await deleteHiloGame({
      userId: claimed.userId,
      guildId: claimed.guildId
    })
    return null
  }

  if (message) {
    await message.edit({
      embeds: [
        renderHiloRevealEmbed({
          firstCard,
          guess,
          winMultiplier,
          bet: claimed.betAmount,
          betId: claimed.gameId,
          globalSettings: guildConfig.globalSettings
        })
      ],
      components: []
    } as never)
    await sleep(700)
  }

  const deck = toMutableDeck(claimed)
  const second = drawHiloCard(deck)
  const secondCard = formatHiloCard(second)
  const outcome = resolveHiloRound(claimed.firstCard.rank, second.rank, guess)

  const totalWinnings =
    outcome === 'win'
      ? claimed.betAmount * winMultiplier
      : outcome === 'push'
        ? claimed.betAmount
        : 0

  const finalBalance = await settleCasinoWinnings({
    userId: claimed.userId,
    guildId: claimed.guildId,
    totalBet: claimed.betAmount,
    winnings: totalWinnings,
    betId: claimed.activeBetId,
    game: 'hilo',
    rounds: 1
  })

  await deleteHiloGame({
    userId: claimed.userId,
    guildId: claimed.guildId
  })

  const liveResult = totalWinnings - claimed.betAmount
  let balanceForEmbed = finalBalance
  if (claimed.showBalance) {
    const user = await getUser({
      userId: claimed.userId,
      guildId: claimed.guildId
    })
    if (user) {
      balanceForEmbed = user.balance + user.lockedBalance
    }
  }

  if (message) {
    await message.edit({
      embeds: [
        renderHiloResultEmbed({
          firstCard,
          secondCard,
          guess,
          winMultiplier,
          bet: claimed.betAmount,
          liveResult,
          showBalance: claimed.showBalance,
          finalBalance: balanceForEmbed,
          betId: claimed.gameId,
          globalSettings: guildConfig.globalSettings
        })
      ],
      components: []
    } as never)
  }

  if (
    outcome === 'win' &&
    shouldAnnounceByMultiplier(
      winMultiplier,
      guildConfig.casinoSettings.winAnnouncements.hiloMinMultiplier
    )
  ) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'hilo',
      lines: [
        formatBigWinLine({
          label: 'Hi-Lo',
          middle: [`**${firstCard}** → **${secondCard}** (${guess})`],
          multiplier: winMultiplier.toFixed(2),
          payout: formatMoney(totalWinnings, guildConfig.globalSettings),
          bet: formatMoney(claimed.betAmount, guildConfig.globalSettings)
        })
      ],
      betId: claimed.gameId,
      sourceChannelId
    })
  }

  return { outcome, totalWinnings, liveResult }
}

export const settleHiloTimeout = async ({
  game,
  guildConfig,
  message
}: {
  game: THiloGame
  guildConfig: TGuildConfiguration | null
  message?: EditableMessage | null
}) => {
  const claimed = await claimHiloGameForSettle({
    gameId: game.gameId,
    guildId: game.guildId
  })
  if (!claimed) return null

  const timeoutFee = claimed.timeoutFeeSnapshot
  const refunded = getHiloTimeoutRefund(claimed.betAmount, timeoutFee)
  const feeKept = claimed.betAmount - refunded

  await settleCasinoWinnings({
    userId: claimed.userId,
    guildId: claimed.guildId,
    totalBet: claimed.betAmount,
    winnings: refunded,
    betId: claimed.activeBetId,
    game: 'hilo',
    rounds: 1
  })

  await deleteHiloGame({
    userId: claimed.userId,
    guildId: claimed.guildId
  })

  if (message) {
    await message.edit({
      embeds: [
        renderHiloTimeoutEmbed({
          firstCard: formatStoredCard(claimed.firstCard),
          bet: claimed.betAmount,
          timeoutFee,
          feeKept,
          refunded,
          betId: claimed.gameId,
          globalSettings: guildConfig?.globalSettings
        })
      ],
      components: []
    } as never)
  }

  return { refunded, feeKept }
}
