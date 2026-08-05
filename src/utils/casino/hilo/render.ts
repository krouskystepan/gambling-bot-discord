import {
  type HiloGuess,
  type HiloStoredCard,
  getHiloWinMultiplier
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable
} from 'discord.js'

import { createBetEmbed } from '@/utils/discord/createEmbed'

import { encodeActionId, encodeGuessId } from './customId'

type MoneySettings = Partial<GlobalSettings> | null | undefined

const formatMult = (mult: number | null) =>
  mult == null ? '-' : `${mult.toFixed(2)}x`

const guessLabel = (guess: HiloGuess) =>
  guess === 'higher' ? '⬆ Higher' : guess === 'lower' ? '⬇ Lower' : '↔ Draw'

/** Blackjack-style card string, e.g. `K♠️`. */
const cardsLine = (first: string, second: string) => `${first} → ${second}`

const betLine = (bet: number, globalSettings: MoneySettings) =>
  `💵 Bet: **${formatMoney(bet, globalSettings)}**`

export const renderHiloBettingEmbed = ({
  gameId,
  bet,
  globalSettings
}: {
  gameId: string
  bet: number | null
  globalSettings?: MoneySettings
}) =>
  createBetEmbed(
    '🃏 Hi-Lo',
    'Blue',
    [
      bet == null
        ? '💵 Bet: **Not set**'
        : `💵 Bet: **${formatMoney(bet, globalSettings)}**`,
      bet == null
        ? '_Set your bet, then deal a card._'
        : '_Deal a card, or change your bet first._'
    ].join('\n\n'),
    gameId
  )

export const renderHiloBettingComponents = ({
  gameId,
  hasBet
}: {
  gameId: string
  hasBet: boolean
}) => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeActionId({ gameId, action: 'deal' }))
      .setLabel('Deal')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasBet),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ gameId, action: 'change' }))
      .setLabel(hasBet ? 'Change bet' : 'Set bet')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ gameId, action: 'close' }))
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
  )
]

export const renderHiloPromptEmbed = ({
  firstCard,
  higherMult,
  lowerMult,
  sameMult,
  bet,
  streak,
  currentMultiplier,
  betId,
  globalSettings
}: {
  firstCard: string
  higherMult: number | null
  lowerMult: number | null
  sameMult: number | null
  bet: number
  streak: number
  currentMultiplier: number
  betId: string
  globalSettings: MoneySettings
}) => {
  const cashOutPayout = bet * currentMultiplier
  const streakLines =
    streak >= 1
      ? [
          `🔥 Streak: **${streak}** · Current · **${formatMult(currentMultiplier)}**`,
          `💰 Cash out: **${formatMoney(cashOutPayout, globalSettings)}**`
        ]
      : []

  return createBetEmbed(
    '🃏 Hi-Lo',
    'Blue',
    [
      betLine(bet, globalSettings),
      ...streakLines,
      `**Card**\n${firstCard}`,
      `**Next step**\n⬆ Higher · **${formatMult(higherMult)}**\n↔ Draw · **${formatMult(sameMult)}**\n⬇ Lower · **${formatMult(lowerMult)}**`
    ].join('\n\n'),
    betId
  )
}

export const renderHiloGuessComponents = ({
  gameId,
  firstRank,
  houseEdge,
  remainingDeck,
  streak = 0,
  currentMultiplier = 1
}: {
  gameId: string
  firstRank: number
  houseEdge: number
  remainingDeck: readonly HiloStoredCard[]
  streak?: number
  currentMultiplier?: number
}) => {
  const higherMult = getHiloWinMultiplier(
    firstRank,
    'higher',
    houseEdge,
    remainingDeck
  )
  const lowerMult = getHiloWinMultiplier(
    firstRank,
    'lower',
    houseEdge,
    remainingDeck
  )
  const sameMult = getHiloWinMultiplier(
    firstRank,
    'same',
    houseEdge,
    remainingDeck
  )

  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeGuessId({ gameId, guess: 'higher' }))
        .setLabel('Higher')
        .setEmoji('⬆')
        .setStyle(ButtonStyle.Success)
        .setDisabled(higherMult == null),
      new ButtonBuilder()
        .setCustomId(encodeGuessId({ gameId, guess: 'same' }))
        .setLabel('Draw')
        .setEmoji('↔')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(sameMult == null),
      new ButtonBuilder()
        .setCustomId(encodeGuessId({ gameId, guess: 'lower' }))
        .setLabel('Lower')
        .setEmoji('⬇')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(lowerMult == null)
    )
  ]

  if (streak >= 1) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(encodeActionId({ gameId, action: 'cashout' }))
          .setLabel(`Cash Out x${currentMultiplier.toFixed(2)}`)
          .setStyle(ButtonStyle.Secondary)
      )
    )
  }

  return rows
}

export const renderHiloRevealEmbed = ({
  firstCard,
  guess,
  winMultiplier,
  bet,
  streak,
  currentMultiplier,
  betId,
  globalSettings
}: {
  firstCard: string
  guess: HiloGuess
  winMultiplier: number
  bet: number
  streak: number
  currentMultiplier: number
  betId: string
  globalSettings: MoneySettings
}) => {
  const sections = [
    betLine(bet, globalSettings),
    `**Cards**\n${cardsLine(firstCard, '??')}`,
    `**Guess**\n${guessLabel(guess)} · step **${formatMult(winMultiplier)}**`
  ]

  if (streak >= 1) {
    sections.splice(
      1,
      0,
      `🔥 Streak: **${streak}** · Current · **${formatMult(currentMultiplier)}**`
    )
  }

  return createBetEmbed('🃏 Revealing...', 'Blue', sections.join('\n\n'), betId)
}

export const renderHiloResultEmbed = ({
  firstCard,
  secondCard,
  guess,
  winMultiplier,
  bet,
  liveResult,
  showBalance,
  finalBalance,
  betId,
  globalSettings,
  autoPlayed = false,
  streak
}: {
  firstCard: string
  secondCard: string
  guess: HiloGuess
  winMultiplier: number
  bet: number
  liveResult: number
  showBalance: boolean | null
  finalBalance: number
  betId: string
  globalSettings: MoneySettings
  autoPlayed?: boolean
  streak?: number
}) => {
  // Title follows money, not card correctness - a correct guess under 1x is still a loss.
  const isProfit = liveResult > 0
  const isBreakEven = liveResult === 0

  const title = isProfit
    ? '🃏 **Win!** 🎉'
    : isBreakEven
      ? '🃏 **Push!** 🤝'
      : '🃏 **Better Luck Next Time...** ❌'

  const color: ColorResolvable = isProfit
    ? 'Green'
    : isBreakEven
      ? 'Yellow'
      : 'Red'
  const totalIcon = isProfit ? '🟢' : isBreakEven ? '🟡' : '🔴'
  const totalAmount =
    liveResult < 0
      ? `-${formatMoney(Math.abs(liveResult), globalSettings)}`
      : formatMoney(liveResult, globalSettings)

  const sections = [
    betLine(bet, globalSettings),
    `**Cards**\n${cardsLine(firstCard, secondCard)}`,
    `**Guess**\n${guessLabel(guess)} · **${formatMult(winMultiplier)}**${
      autoPlayed ? ' _(auto - safest side)_' : ''
    }${streak != null && streak > 0 ? ` · streak **${streak}**` : ''}`,
    `💰 Total: ${totalIcon} **${totalAmount}**`
  ]

  if (showBalance) {
    sections.push(
      `🏦 Balance: **${formatMoney(finalBalance, globalSettings)}**`
    )
  }

  sections.push('_Rebet keeps the same stake, or Change to edit._')

  return createBetEmbed(title, color, sections.join('\n\n'), betId)
}

export const renderHiloCashOutEmbed = ({
  firstCard,
  bet,
  streak,
  multiplier,
  payout,
  liveResult,
  showBalance,
  finalBalance,
  betId,
  globalSettings,
  autoPlayed = false
}: {
  firstCard: string
  bet: number
  streak: number
  multiplier: number
  payout: number
  liveResult: number
  showBalance: boolean | null
  finalBalance: number
  betId: string
  globalSettings: MoneySettings
  autoPlayed?: boolean
}) => {
  const isProfit = liveResult > 0
  const isBreakEven = liveResult === 0
  const title = isProfit
    ? '🃏 **Cashed Out!** 🎉'
    : isBreakEven
      ? '🃏 **Push!** 🤝'
      : '🃏 **Cashed Out**'

  const color: ColorResolvable = isProfit
    ? 'Green'
    : isBreakEven
      ? 'Yellow'
      : 'Red'
  const totalIcon = isProfit ? '🟢' : isBreakEven ? '🟡' : '🔴'
  const totalAmount =
    liveResult < 0
      ? `-${formatMoney(Math.abs(liveResult), globalSettings)}`
      : formatMoney(liveResult, globalSettings)

  const sections = [
    betLine(bet, globalSettings),
    `**Card**\n${firstCard}`,
    `🔥 Streak: **${streak}** · **${formatMult(multiplier)}**${
      autoPlayed ? ' _(auto cash-out)_' : ''
    }`,
    `💵 Payout: **${formatMoney(payout, globalSettings)}**`,
    `💰 Total: ${totalIcon} **${totalAmount}**`
  ]

  if (showBalance) {
    sections.push(
      `🏦 Balance: **${formatMoney(finalBalance, globalSettings)}**`
    )
  }

  sections.push('_Rebet keeps the same stake, or Change to edit._')

  return createBetEmbed(title, color, sections.join('\n\n'), betId)
}

export const renderHiloResultComponents = ({ gameId }: { gameId: string }) => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeActionId({ gameId, action: 'rebet' }))
      .setLabel('Rebet')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ gameId, action: 'change' }))
      .setLabel('Change bet')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ gameId, action: 'close' }))
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
  )
]
