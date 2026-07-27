import {
  type BaccaratBetSide,
  type BaccaratCard,
  type BaccaratRoundResult,
  handTotal,
  isPair,
  resolveBaccaratBet,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type {
  GlobalSettings,
  TGuildConfiguration
} from 'gambling-bot-shared/guild'

import { deleteBaccaratGame, settleCasinoWinnings } from '@/services'
import { dealBaccarat } from '@/utils/casino/rng'
import { sleep } from '@/utils/common/utils'
import { formatBigWinLine } from '@/utils/discord/formatBigWinMessage'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

import {
  BACCARAT_SIDE_LABELS,
  renderBaccaratDealEmbed,
  renderBaccaratResultEmbed
} from './render'

/** A bit of tease per card without dragging the full deal out. */
const DEAL_STEP_MS = 550

type MoneySettings = Partial<GlobalSettings> | null | undefined
type EditableMessage = { edit: (...args: never[]) => Promise<unknown> }
type AnnounceGuild = Parameters<typeof tryAnnounceBigWin>[0]['guild']

const showDealStep = async ({
  message,
  side,
  bet,
  playerCards,
  bankerCards,
  status,
  betId,
  globalSettings
}: {
  message: EditableMessage
  side: BaccaratBetSide
  bet: number
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  status: string
  betId: string
  globalSettings: MoneySettings
}) => {
  await message.edit({
    embeds: [
      renderBaccaratDealEmbed({
        side,
        bet,
        playerCards,
        bankerCards,
        status,
        betId,
        globalSettings
      })
    ],
    components: []
  } as never)
}

export const resolvePendingBaccaratRound = ({
  side,
  playerCards,
  bankerCards,
  winMultipliers
}: {
  side: BaccaratBetSide
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  winMultipliers: TGuildConfiguration['casinoSettings']['baccarat']['winMultipliers']
}) => {
  const playerTotal = handTotal(playerCards)
  const bankerTotal = handTotal(bankerCards)
  const round: BaccaratRoundResult = {
    playerCards,
    bankerCards,
    outcome:
      playerTotal > bankerTotal
        ? 'player'
        : bankerTotal > playerTotal
          ? 'banker'
          : 'tie',
    playerPair: isPair(playerCards),
    bankerPair: isPair(bankerCards),
    playerTotal,
    bankerTotal
  }
  const resolution = resolveBaccaratBet(side, round, winMultipliers)

  return { round, resolution }
}

const settleBaccaratRound = async ({
  message,
  side,
  round,
  userId,
  guildId,
  betId,
  betAmount,
  showBalance,
  winMultipliers,
  globalSettings,
  guild,
  guildConfig,
  sourceChannelId
}: {
  message?: EditableMessage | null
  side: BaccaratBetSide
  round: BaccaratRoundResult
  userId: string
  guildId: string
  betId: string
  betAmount: number
  showBalance: boolean
  winMultipliers: TGuildConfiguration['casinoSettings']['baccarat']['winMultipliers']
  globalSettings: MoneySettings
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  sourceChannelId: string
}) => {
  const { resolution } = resolvePendingBaccaratRound({
    side,
    playerCards: round.playerCards,
    bankerCards: round.bankerCards,
    winMultipliers
  })
  const winnings = betAmount * resolution.multiplier

  const finalBalance = await settleCasinoWinnings({
    userId,
    guildId,
    totalBet: betAmount,
    winnings,
    betId,
    game: 'baccarat'
  })

  if (message) {
    await message.edit({
      embeds: [
        renderBaccaratResultEmbed({
          side,
          round,
          resolution,
          bet: betAmount,
          winnings,
          showBalance,
          finalBalance,
          betId,
          globalSettings
        })
      ],
      components: []
    } as never)
  }

  if (
    resolution.won &&
    shouldAnnounceByMultiplier(
      resolution.multiplier,
      guildConfig.casinoSettings.winAnnouncements.baccaratMinMultiplier
    )
  ) {
    tryAnnounceBigWin({
      guild,
      guildConfig,
      game: 'baccarat',
      lines: [
        formatBigWinLine({
          label: 'Baccarat',
          middle: [
            `**${BACCARAT_SIDE_LABELS[side]}**`,
            `${round.playerTotal} vs ${round.bankerTotal}`
          ],
          multiplier: resolution.multiplier.toFixed(2),
          payout: formatMoney(winnings, globalSettings),
          bet: formatMoney(betAmount, globalSettings)
        })
      ],
      betId,
      sourceChannelId
    })
  }

  return { round, resolution, winnings, finalBalance }
}

export const recoverBaccaratDeal = async ({
  message,
  side,
  playerCards,
  bankerCards,
  userId,
  guildId,
  betId,
  betAmount,
  showBalance,
  winMultipliers,
  globalSettings,
  guild,
  guildConfig,
  sourceChannelId
}: {
  message?: EditableMessage | null
  side: BaccaratBetSide
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  userId: string
  guildId: string
  betId: string
  betAmount: number
  showBalance: boolean
  winMultipliers: TGuildConfiguration['casinoSettings']['baccarat']['winMultipliers']
  globalSettings: MoneySettings
  guild: AnnounceGuild
  guildConfig: TGuildConfiguration
  sourceChannelId: string
}) =>
  settleBaccaratRound({
    message,
    side,
    round: resolvePendingBaccaratRound({
      side,
      playerCards,
      bankerCards,
      winMultipliers
    }).round,
    userId,
    guildId,
    betId,
    betAmount,
    showBalance,
    winMultipliers,
    globalSettings,
    guild,
    guildConfig,
    sourceChannelId
  })

export const playBaccaratSide = async ({
  message,
  side,
  userId,
  guildId,
  betId,
  betAmount,
  showBalance,
  skipAnimations,
  winMultipliers,
  globalSettings,
  guild,
  guildConfig,
  sourceChannelId,
  round = dealBaccarat()
}: {
  message: EditableMessage
  side: BaccaratBetSide
  userId: string
  guildId: string
  betId: string
  betAmount: number
  showBalance: boolean
  skipAnimations: boolean
  winMultipliers: TGuildConfiguration['casinoSettings']['baccarat']['winMultipliers']
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
        side,
        bet: betAmount,
        playerCards: playerShown,
        bankerCards: bankerShown,
        status: '⏳ Dealing...',
        betId,
        globalSettings
      })
      await sleep(DEAL_STEP_MS)

      bankerShown.push(round.bankerCards[i]!)
      await showDealStep({
        message,
        side,
        bet: betAmount,
        playerCards: playerShown,
        bankerCards: bankerShown,
        status: '⏳ Dealing...',
        betId,
        globalSettings
      })
      await sleep(DEAL_STEP_MS)
    }

    if (round.playerCards.length > 2) {
      playerShown.push(round.playerCards[2]!)
      await showDealStep({
        message,
        side,
        bet: betAmount,
        playerCards: playerShown,
        bankerCards: bankerShown,
        status: '⏳ Player draws third...',
        betId,
        globalSettings
      })
      await sleep(DEAL_STEP_MS)
    }

    if (round.bankerCards.length > 2) {
      bankerShown.push(round.bankerCards[2]!)
      await showDealStep({
        message,
        side,
        bet: betAmount,
        playerCards: playerShown,
        bankerCards: bankerShown,
        status: '⏳ Banker draws third...',
        betId,
        globalSettings
      })
      await sleep(DEAL_STEP_MS)
    }
  }

  const settled = await settleBaccaratRound({
    message,
    side,
    round,
    userId,
    guildId,
    betId,
    betAmount,
    showBalance,
    winMultipliers,
    globalSettings,
    guild,
    guildConfig,
    sourceChannelId
  })

  await deleteBaccaratGame({ userId, guildId })

  return settled
}
