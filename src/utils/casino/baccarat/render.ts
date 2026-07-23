import {
  BACCARAT_BET_SIDES,
  type BaccaratBetSide,
  type BaccaratCard,
  type BaccaratRoundResult,
  handTotal
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ColorResolvable
} from 'discord.js'

import { formatBaccaratCard } from '@/utils/casino/rng'
import { createBetEmbed } from '@/utils/discord/createEmbed'

import { encodeId } from './customId'

type MoneySettings = Partial<GlobalSettings> | null | undefined

export const BACCARAT_SIDE_LABELS: Record<BaccaratBetSide, string> = {
  player: 'Player',
  banker: 'Banker',
  tie: 'Tie',
  playerPair: 'Player Pair',
  bankerPair: 'Banker Pair'
}

const OUTCOME_LABELS = {
  player: 'Player',
  banker: 'Banker',
  tie: 'Tie'
} as const

const betLine = (bet: number, globalSettings: MoneySettings) =>
  `💵 Bet: **${formatMoney(bet, globalSettings)}**`

export const formatBaccaratHand = (cards: BaccaratCard[], total: number) =>
  `${cards.map(formatBaccaratCard).join(' ')} (**${total}**)`

const formatMult = (mult: number) => `${Number(mult).toFixed(2)}x`

const oddsBlock = (winMultipliers: Record<BaccaratBetSide, number>) =>
  BACCARAT_BET_SIDES.map(
    (side) =>
      `• **${BACCARAT_SIDE_LABELS[side]}** · **${formatMult(winMultipliers[side])}**`
  ).join('\n')

export const renderBaccaratPromptEmbed = ({
  bet,
  winMultipliers,
  betId,
  globalSettings
}: {
  bet: number
  winMultipliers: Record<BaccaratBetSide, number>
  betId: string
  globalSettings: MoneySettings
}) =>
  createBetEmbed(
    '🃏 Baccarat',
    'Blue',
    [
      betLine(bet, globalSettings),
      `**Payouts**\n${oddsBlock(winMultipliers)}`
    ].join('\n\n'),
    betId
  )

export const renderBaccaratButtons = ({
  betId,
  showBalance,
  skipAnimations
}: {
  betId: string
  showBalance: boolean
  skipAnimations: boolean
}) => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        encodeId({ betId, side: 'player', showBalance, skipAnimations })
      )
      .setLabel('Player')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(
        encodeId({ betId, side: 'banker', showBalance, skipAnimations })
      )
      .setLabel('Banker')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(
        encodeId({ betId, side: 'tie', showBalance, skipAnimations })
      )
      .setLabel('Tie')
      .setStyle(ButtonStyle.Success)
  ),
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        encodeId({ betId, side: 'playerPair', showBalance, skipAnimations })
      )
      .setLabel('Player Pair')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(
        encodeId({ betId, side: 'bankerPair', showBalance, skipAnimations })
      )
      .setLabel('Banker Pair')
      .setStyle(ButtonStyle.Secondary)
  )
]

export const renderBaccaratTimeoutEmbed = ({
  betId,
  autoRefund = false
}: {
  betId: string
  autoRefund?: boolean
}) =>
  createBetEmbed(
    '🃏 Baccarat - Timed Out',
    'Red',
    autoRefund
      ? 'No side chosen in time - bet was auto-refunded.'
      : 'No side chosen in time - bet refunded.',
    betId
  )

export const renderBaccaratDealEmbed = ({
  side,
  bet,
  playerCards,
  bankerCards,
  status,
  betId,
  globalSettings
}: {
  side: BaccaratBetSide
  bet: number
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  status: string
  betId: string
  globalSettings: MoneySettings
}) => {
  const lines = [
    betLine(bet, globalSettings),
    `🎯 Side: **${BACCARAT_SIDE_LABELS[side]}**`,
    playerCards.length
      ? `👤 Player: ${formatBaccaratHand(playerCards, handTotal(playerCards))}`
      : '👤 Player: ⏳',
    bankerCards.length
      ? `🏦 Banker: ${formatBaccaratHand(bankerCards, handTotal(bankerCards))}`
      : '🏦 Banker: ⏳',
    status
  ]

  return createBetEmbed('🃏 Dealing...', 'Blue', lines.join('\n\n'), betId)
}

export const renderBaccaratResultEmbed = ({
  side,
  round,
  resolution,
  bet,
  winnings,
  showBalance,
  finalBalance,
  betId,
  globalSettings
}: {
  side: BaccaratBetSide
  round: BaccaratRoundResult
  resolution: { won: boolean; push: boolean; multiplier: number }
  bet: number
  winnings: number
  showBalance: boolean | null
  finalBalance: number
  betId: string
  globalSettings: MoneySettings
}) => {
  const liveResult = winnings - bet
  const isWin = liveResult > 0
  const isLoss = liveResult < 0

  const title = resolution.push
    ? '🃏 **Push!** 🤝'
    : isWin
      ? '🃏 **Win!** 🎉'
      : '🃏 **Better Luck Next Time...** ❌'

  const color: ColorResolvable = resolution.push
    ? 'Yellow'
    : isWin
      ? 'Green'
      : 'Red'

  const totalIcon = resolution.push ? '🟡' : isWin ? '🟢' : '🔴'
  const totalAmount = isLoss
    ? `-${formatMoney(Math.abs(liveResult), globalSettings)}`
    : formatMoney(liveResult, globalSettings)

  const pairHints = [
    round.playerPair ? 'Player Pair' : null,
    round.bankerPair ? 'Banker Pair' : null
  ]
    .filter(Boolean)
    .join(' · ')

  const sideResult = resolution.push
    ? 'Push (stake returned)'
    : resolution.won
      ? `Won · **${formatMult(resolution.multiplier)}**`
      : 'Lost'

  const sections = [
    betLine(bet, globalSettings),
    `🎯 Side: **${BACCARAT_SIDE_LABELS[side]}** · ${sideResult}`,
    `👤 Player: ${formatBaccaratHand(round.playerCards, round.playerTotal)}`,
    `🏦 Banker: ${formatBaccaratHand(round.bankerCards, round.bankerTotal)}`,
    `🏁 Outcome: **${OUTCOME_LABELS[round.outcome]}**${
      pairHints ? `\n🔗 ${pairHints}` : ''
    }`,
    `💰 Total: ${totalIcon} **${totalAmount}**`
  ]

  if (showBalance) {
    sections.push(
      `🏦 Balance: **${formatMoney(finalBalance, globalSettings)}**`
    )
  }

  return createBetEmbed(title, color, sections.join('\n\n'), betId)
}
