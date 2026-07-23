import {
  type BaccaratBetSide,
  type BaccaratCard,
  resolveBaccaratBet,
  shouldAnnounceByMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type {
  GlobalSettings,
  TGuildConfiguration
} from 'gambling-bot-shared/guild'

import type { Guild, Message } from 'discord.js'

import { settleCasinoWinnings } from '@/services'
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
  message: Message
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
  })
}

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
  sourceChannelId
}: {
  message: Message
  side: BaccaratBetSide
  userId: string
  guildId: string
  betId: string
  betAmount: number
  showBalance: boolean
  skipAnimations: boolean
  winMultipliers: TGuildConfiguration['casinoSettings']['baccarat']['winMultipliers']
  globalSettings: MoneySettings
  guild: Guild | null
  guildConfig: TGuildConfiguration
  sourceChannelId: string
}) => {
  const round = dealBaccarat()
  const resolution = resolveBaccaratBet(side, round, winMultipliers)
  const winnings = betAmount * resolution.multiplier

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

  const finalBalance = await settleCasinoWinnings({
    userId,
    guildId,
    totalBet: betAmount,
    winnings,
    betId,
    game: 'baccarat'
  })

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
  })

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
}
