import {
  type BaccaratCard,
  type BaccaratRoundResult,
  type BaccaratSlipBet,
  type CasinoSessionStats,
  baccaratRoundFromCards,
  bumpSessionStats,
  emptySessionStats,
  resolveBaccaratSlip,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type {
  GlobalSettings,
  TGuildConfiguration
} from 'gambling-bot-shared/guild'

import { settleCasinoWinnings, updateBaccaratGame } from '@/services'
import { dealBaccarat } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import {
  BACCARAT_SIDE_LABELS,
  renderBaccaratDealEmbed,
  renderBaccaratResultComponents,
  renderBaccaratResultEmbed
} from './render'
import { slipTotal } from './slip'

/** A bit of tease per card without dragging the full deal out. */
const DEAL_STEP_MS = 550

type MoneySettings = Partial<GlobalSettings> | null | undefined
type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

const showDealStep = async ({
  message,
  bets,
  playerCards,
  bankerCards,
  status,
  gameId,
  globalSettings
}: {
  message: EditableMessage
  bets: BaccaratSlipBet[]
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  status: string
  gameId: string
  globalSettings: MoneySettings
}) => {
  await message.edit({
    embeds: [
      renderBaccaratDealEmbed({
        bets,
        playerCards,
        bankerCards,
        status,
        gameId,
        globalSettings
      })
    ],
    components: []
  } as never)
}

export const resolvePendingBaccaratRound = ({
  playerCards,
  bankerCards,
  bets,
  baccaratSettings
}: {
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  bets: BaccaratSlipBet[]
  baccaratSettings: TGuildConfiguration['casinoSettings']['baccarat']
}) => {
  const round = baccaratRoundFromCards(playerCards, bankerCards)
  const slip = resolveBaccaratSlip(bets, round, baccaratSettings)

  return { round, slip }
}

const settleBaccaratRound = async ({
  message,
  bets,
  round,
  userId,
  guildId,
  gameId,
  betId,
  sessionStats = emptySessionStats(),
  showBalance,
  baccaratSettings,
  globalSettings,
  guild,
  guildConfig,
  sourceChannelId
}: {
  message?: EditableMessage | null
  bets: BaccaratSlipBet[]
  round: BaccaratRoundResult
  userId: string
  guildId: string
  gameId: string
  betId: string
  sessionStats?: CasinoSessionStats
  showBalance: boolean
  baccaratSettings: TGuildConfiguration['casinoSettings']['baccarat']
  globalSettings: MoneySettings
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  sourceChannelId: string
}) => {
  const { slip } = resolvePendingBaccaratRound({
    playerCards: round.playerCards,
    bankerCards: round.bankerCards,
    bets,
    baccaratSettings
  })
  const totalBet = slipTotal(bets)
  const { lines, totalWinnings } = slip

  const finalBalance = await settleCasinoWinnings({
    userId,
    guildId,
    totalBet,
    winnings: totalWinnings,
    betId,
    game: 'baccarat',
    rounds: 1
  })

  await updateBaccaratGame({
    userId,
    guildId,
    phase: 'result',
    activeBetId: null,
    pendingDeal: null,
    lockedAmount: null,
    lastBets: bets,
    bets: [],
    sessionStats: bumpSessionStats(sessionStats, {
      totalBet,
      totalPayout: totalWinnings
    })
  })

  if (message) {
    await message.edit({
      embeds: [
        renderBaccaratResultEmbed({
          round,
          lines,
          totalBet,
          totalWinnings,
          showBalance,
          finalBalance,
          gameId,
          globalSettings
        })
      ],
      components: renderBaccaratResultComponents({
        gameId,
        canRebet: bets.length > 0
      })
    } as never)
  }

  const announceLines = lines.filter(
    (line) =>
      line.won &&
      shouldAnnounceByMultiplier(
        line.multiplier,
        guildConfig.casinoSettings.winAnnouncements.baccaratMinMultiplier
      )
  )

  if (announceLines.length > 0) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'baccarat',
      lines: announceLines.map((line) =>
        formatBigWinLine({
          label: 'Baccarat',
          middle: [
            `**${BACCARAT_SIDE_LABELS[line.side]}**`,
            `${round.playerTotal} vs ${round.bankerTotal}`
          ],
          multiplier: line.multiplier.toFixed(2),
          payout: formatMoney(line.winnings, globalSettings),
          bet: formatMoney(line.amount, globalSettings)
        })
      ),
      betId: gameId,
      sourceChannelId
    })
  }

  return { round, slip, totalWinnings, finalBalance }
}

export const recoverBaccaratDeal = async ({
  message,
  playerCards,
  bankerCards,
  bets,
  userId,
  guildId,
  gameId,
  betId,
  sessionStats,
  showBalance,
  baccaratSettings,
  globalSettings,
  guild,
  guildConfig,
  sourceChannelId
}: {
  message?: EditableMessage | null
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  bets: BaccaratSlipBet[]
  userId: string
  guildId: string
  gameId: string
  betId: string
  sessionStats?: CasinoSessionStats
  showBalance: boolean
  baccaratSettings: TGuildConfiguration['casinoSettings']['baccarat']
  globalSettings: MoneySettings
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  sourceChannelId: string
}) =>
  settleBaccaratRound({
    message,
    bets,
    round: baccaratRoundFromCards(playerCards, bankerCards),
    userId,
    guildId,
    gameId,
    betId,
    sessionStats,
    showBalance,
    baccaratSettings,
    globalSettings,
    guild,
    guildConfig,
    sourceChannelId
  })

export const playBaccaratSlip = async ({
  message,
  bets,
  userId,
  guildId,
  gameId,
  betId,
  sessionStats,
  showBalance,
  skipAnimations,
  baccaratSettings,
  globalSettings,
  guild,
  guildConfig,
  sourceChannelId,
  round = dealBaccarat()
}: {
  message: EditableMessage
  bets: BaccaratSlipBet[]
  userId: string
  guildId: string
  gameId: string
  betId: string
  sessionStats?: CasinoSessionStats
  showBalance: boolean
  skipAnimations: boolean
  baccaratSettings: TGuildConfiguration['casinoSettings']['baccarat']
  globalSettings: MoneySettings
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  sourceChannelId: string
  round?: BaccaratRoundResult
}) => {
  if (!skipAnimations) {
    const playerShown: BaccaratCard[] = []
    const bankerShown: BaccaratCard[] = []

    // Real punto banco order: P1, B1, P2, B2, then optional thirds.
    for (let i = 0; i < 2; i++) {
      playerShown.push(round.playerCards[i]!)
      await showDealStep({
        message,
        bets,
        playerCards: playerShown,
        bankerCards: bankerShown,
        status: '⏳ Dealing...',
        gameId,
        globalSettings
      })
      await sleep(DEAL_STEP_MS)

      bankerShown.push(round.bankerCards[i]!)
      await showDealStep({
        message,
        bets,
        playerCards: playerShown,
        bankerCards: bankerShown,
        status: '⏳ Dealing...',
        gameId,
        globalSettings
      })
      await sleep(DEAL_STEP_MS)
    }

    if (round.playerCards.length > 2) {
      playerShown.push(round.playerCards[2]!)
      await showDealStep({
        message,
        bets,
        playerCards: playerShown,
        bankerCards: bankerShown,
        status: '⏳ Player draws third...',
        gameId,
        globalSettings
      })
      await sleep(DEAL_STEP_MS)
    }

    if (round.bankerCards.length > 2) {
      bankerShown.push(round.bankerCards[2]!)
      await showDealStep({
        message,
        bets,
        playerCards: playerShown,
        bankerCards: bankerShown,
        status: '⏳ Banker draws third...',
        gameId,
        globalSettings
      })
      await sleep(DEAL_STEP_MS)
    }
  }

  return settleBaccaratRound({
    message,
    bets,
    round,
    userId,
    guildId,
    gameId,
    betId,
    sessionStats,
    showBalance,
    baccaratSettings,
    globalSettings,
    guild,
    guildConfig,
    sourceChannelId
  })
}
