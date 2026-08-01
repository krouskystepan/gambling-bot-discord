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

import { encodeActionId, encodeSideId } from './customId'

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
  gameId,
  globalSettings
}: {
  bet: number
  winMultipliers: Record<BaccaratBetSide, number>
  gameId: string
  globalSettings: MoneySettings
}) =>
  createBetEmbed(
    '🃏 Baccarat',
    'Blue',
    [
      betLine(bet, globalSettings),
      `**Payouts**\n${oddsBlock(winMultipliers)}`,
      '_Pick a side to deal, or change your bet first._'
    ].join('\n\n'),
    gameId
  )

/** Side picks plus table controls, shown while the session waits for a bet. */
export const renderBaccaratButtons = ({ gameId }: { gameId: string }) => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeSideId({ kind: 'side', gameId, side: 'player' }))
      .setLabel('Player')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encodeSideId({ kind: 'side', gameId, side: 'banker' }))
      .setLabel('Banker')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(encodeSideId({ kind: 'side', gameId, side: 'tie' }))
      .setLabel('Tie')
      .setStyle(ButtonStyle.Success)
  ),
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeSideId({ kind: 'side', gameId, side: 'playerPair' }))
      .setLabel('Player Pair')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(encodeSideId({ kind: 'side', gameId, side: 'bankerPair' }))
      .setLabel('Banker Pair')
      .setStyle(ButtonStyle.Secondary)
  ),
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'amount' }))
      .setLabel('Change bet')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'close' }))
      .setLabel('Close')
      .setStyle(ButtonStyle.Secondary)
  )
]

/** Between-round controls shown once a round is settled. */
export const renderBaccaratResultComponents = ({
  gameId,
  canRebet
}: {
  gameId: string
  canRebet: boolean
}) => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'rebet' }))
      .setLabel('Rebet')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canRebet),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'change' }))
      .setLabel('Change')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'close' }))
      .setLabel('Close')
      .setStyle(ButtonStyle.Secondary)
  )
]

export const renderBaccaratDealEmbed = ({
  side,
  bet,
  playerCards,
  bankerCards,
  status,
  gameId,
  globalSettings
}: {
  side: BaccaratBetSide
  bet: number
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  status: string
  gameId: string
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

  return createBetEmbed('🃏 Dealing...', 'Blue', lines.join('\n\n'), gameId)
}

export const renderBaccaratResultEmbed = ({
  side,
  round,
  resolution,
  bet,
  winnings,
  showBalance,
  finalBalance,
  gameId,
  globalSettings
}: {
  side: BaccaratBetSide
  round: BaccaratRoundResult
  resolution: { won: boolean; push: boolean; multiplier: number }
  bet: number
  winnings: number
  showBalance: boolean | null
  finalBalance: number
  gameId: string
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

  sections.push('_Rebet repeats the same side and stake, or Change to edit._')

  return createBetEmbed(title, color, sections.join('\n\n'), gameId)
}
