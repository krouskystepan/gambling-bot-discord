import {
  type HiloGuess,
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
  betId,
  globalSettings
}: {
  firstCard: string
  higherMult: number | null
  lowerMult: number | null
  sameMult: number | null
  bet: number
  betId: string
  globalSettings: MoneySettings
}) =>
  createBetEmbed(
    '🃏 Hi-Lo',
    'Blue',
    [
      betLine(bet, globalSettings),
      `**Card**\n${firstCard}`,
      `**Odds**\n⬆ Higher · **${formatMult(higherMult)}**\n↔ Draw · **${formatMult(sameMult)}**\n⬇ Lower · **${formatMult(lowerMult)}**`
    ].join('\n\n'),
    betId
  )

export const renderHiloGuessComponents = ({
  gameId,
  firstRank,
  houseEdge
}: {
  gameId: string
  firstRank: number
  houseEdge: number
}) => {
  const higherMult = getHiloWinMultiplier(firstRank, 'higher', houseEdge)
  const lowerMult = getHiloWinMultiplier(firstRank, 'lower', houseEdge)
  const sameMult = getHiloWinMultiplier(firstRank, 'same', houseEdge)

  return [
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
}

export const renderHiloRevealEmbed = ({
  firstCard,
  guess,
  winMultiplier,
  bet,
  betId,
  globalSettings
}: {
  firstCard: string
  guess: HiloGuess
  winMultiplier: number
  bet: number
  betId: string
  globalSettings: MoneySettings
}) =>
  createBetEmbed(
    '🃏 Revealing...',
    'Blue',
    [
      betLine(bet, globalSettings),
      `**Cards**\n${cardsLine(firstCard, '??')}`,
      `**Guess**\n${guessLabel(guess)} · **${formatMult(winMultiplier)}**`
    ].join('\n\n'),
    betId
  )

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
  autoPlayed = false
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
    }`,
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
