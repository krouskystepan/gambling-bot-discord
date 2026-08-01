import {
  type HiloGuess,
  type THiloGame,
  bumpSessionStats,
  getHiloWinMultiplier,
  pickSafestHiloGuess,
  resolveHiloRound,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'

import {
  claimHiloGameForSettle,
  getUser,
  settleCasinoWinnings,
  updateHiloGame
} from '@/services'
import type { HiloCard } from '@/utils/casino/rng'
import { drawHiloCard, formatHiloCard } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import {
  renderHiloResultComponents,
  renderHiloResultEmbed,
  renderHiloRevealEmbed
} from './render'

type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

/** Copy card fields explicitly - mongoose subdocs do not spread via `{...card}`. */
const toHiloCard = (card: NonNullable<THiloGame['firstCard']>): HiloCard => ({
  label: card.label,
  suite: card.suite,
  rank: card.rank
})

const toMutableDeck = (game: THiloGame): HiloCard[] =>
  game.remainingDeck.map(toHiloCard)

const formatStoredCard = (card: NonNullable<THiloGame['firstCard']>) =>
  formatHiloCard(toHiloCard(card))

const parkInResult = async ({
  game,
  sessionStats,
  betAmount
}: {
  game: THiloGame
  sessionStats: THiloGame['sessionStats']
  betAmount: number
}) =>
  updateHiloGame({
    userId: game.userId,
    guildId: game.guildId,
    status: 'RESULT',
    activeBetId: null,
    betAmount,
    firstCard: null,
    remainingDeck: [],
    sessionStats
  })

export const settleHiloGuess = async ({
  game,
  guess,
  guildConfig,
  guild,
  sourceChannelId,
  message,
  autoPlayed = false
}: {
  game: THiloGame
  guess: HiloGuess
  guildConfig: TGuildConfiguration
  guild: AnnounceGuild
  sourceChannelId: string
  message?: EditableMessage | null
  /** True when the worker auto-picked the safest side after a guess timeout. */
  autoPlayed?: boolean
}) => {
  const claimed = await claimHiloGameForSettle({
    gameId: game.gameId,
    guildId: game.guildId
  })
  if (!claimed) return null

  const stake = claimed.betAmount
  const firstStored = claimed.firstCard
  const betId = claimed.activeBetId
  if (stake == null || !firstStored || !betId) {
    await parkInResult({
      game: claimed,
      sessionStats: claimed.sessionStats,
      betAmount: stake ?? 0
    })
    return null
  }

  const firstCard = formatStoredCard(firstStored)
  const winMultiplier = getHiloWinMultiplier(
    firstStored.rank,
    guess,
    claimed.houseEdgeSnapshot
  )

  if (winMultiplier == null) {
    await settleCasinoWinnings({
      userId: claimed.userId,
      guildId: claimed.guildId,
      totalBet: stake,
      winnings: stake,
      betId,
      game: 'hilo',
      rounds: 1
    })

    const sessionStats = bumpSessionStats(claimed.sessionStats, {
      totalBet: stake,
      totalPayout: stake
    })

    await parkInResult({ game: claimed, sessionStats, betAmount: stake })

    if (message) {
      await message.edit({
        embeds: [
          createBetEmbed(
            '🃏 Hi-Lo',
            'Yellow',
            [
              `💵 Bet: **${formatMoney(stake, guildConfig.globalSettings)}**`,
              `**Card**\n${firstCard}`,
              'That side cannot win - your bet was returned.',
              '_Rebet keeps the same stake, or Change to edit._'
            ].join('\n\n'),
            claimed.gameId
          )
        ],
        components: renderHiloResultComponents({ gameId: claimed.gameId })
      } as never)
    }

    return null
  }

  if (message) {
    await message.edit({
      embeds: [
        renderHiloRevealEmbed({
          firstCard,
          guess,
          winMultiplier,
          bet: stake,
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
  const outcome = resolveHiloRound(firstStored.rank, second.rank, guess)

  const totalWinnings = outcome === 'win' ? stake * winMultiplier : 0

  const finalBalance = await settleCasinoWinnings({
    userId: claimed.userId,
    guildId: claimed.guildId,
    totalBet: stake,
    winnings: totalWinnings,
    betId,
    game: 'hilo',
    rounds: 1
  })

  const sessionStats = bumpSessionStats(claimed.sessionStats, {
    totalBet: stake,
    totalPayout: totalWinnings
  })

  await parkInResult({ game: claimed, sessionStats, betAmount: stake })

  const liveResult = totalWinnings - stake
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
          bet: stake,
          liveResult,
          showBalance: claimed.showBalance,
          finalBalance: balanceForEmbed,
          betId: claimed.gameId,
          globalSettings: guildConfig.globalSettings,
          autoPlayed
        })
      ],
      components: renderHiloResultComponents({ gameId: claimed.gameId })
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
          bet: formatMoney(stake, guildConfig.globalSettings)
        })
      ],
      betId: claimed.gameId,
      sourceChannelId
    })
  }

  return { outcome, totalWinnings, liveResult, sessionStats }
}

/** Timed-out waiting rounds auto-play the safest (lowest-x) side. */
export const settleHiloTimeout = async ({
  game,
  guildConfig,
  guild = null,
  message
}: {
  game: THiloGame
  guildConfig: TGuildConfiguration | null
  guild?: AnnounceGuild
  message?: EditableMessage | null
}) => {
  if (!guildConfig) return null

  const firstStored = game.firstCard
  if (!firstStored) return null

  const guess = pickSafestHiloGuess(firstStored.rank, game.houseEdgeSnapshot)

  return settleHiloGuess({
    game,
    guess,
    guildConfig,
    guild,
    sourceChannelId: game.channelId,
    message,
    autoPlayed: true
  })
}
