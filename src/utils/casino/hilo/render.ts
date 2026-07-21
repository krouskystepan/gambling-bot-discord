import type { HiloGuess } from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'

import type { ColorResolvable } from 'discord.js'

import { createBetEmbed } from '@/utils/discord/createEmbed'

type MoneySettings = Partial<GlobalSettings> | null | undefined

const formatMult = (mult: number | null) =>
  mult == null ? '—' : `${mult.toFixed(2)}x`

const guessLabel = (guess: HiloGuess) =>
  guess === 'higher' ? '⬆ Higher' : '⬇ Lower'

/** Blackjack-style card string, e.g. `K♠️`. */
const cardsLine = (first: string, second: string) => `${first} → ${second}`

const betLine = (bet: number, globalSettings: MoneySettings) =>
  `💵 Bet: **${formatMoney(bet, globalSettings)}**`

export const renderHiloPromptEmbed = ({
  firstCard,
  higherMult,
  lowerMult,
  bet,
  betId,
  globalSettings
}: {
  firstCard: string
  higherMult: number | null
  lowerMult: number | null
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
      `**Odds**\n⬆ Higher · **${formatMult(higherMult)}**\n⬇ Lower · **${formatMult(lowerMult)}**`
    ].join('\n\n'),
    betId
  )

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

export const renderHiloTimeoutEmbed = ({
  firstCard,
  betId
}: {
  firstCard: string
  betId: string
}) =>
  createBetEmbed(
    '🃏 Hi-Lo — Timed Out',
    'Red',
    ['No guess in time — bet refunded.', `**Card**\n${firstCard}`].join('\n\n'),
    betId
  )

export const renderHiloResultEmbed = ({
  outcome,
  firstCard,
  secondCard,
  guess,
  winMultiplier,
  bet,
  liveResult,
  showBalance,
  finalBalance,
  betId,
  globalSettings
}: {
  outcome: 'win' | 'lose' | 'push'
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
}) => {
  const isWin = outcome === 'win'
  const isLoss = outcome === 'lose'

  const title = isWin
    ? '🃏 **Win!** 🎉'
    : isLoss
      ? '🃏 **Better Luck Next Time...** ❌'
      : '🃏 **Push!** 🤝'

  const color: ColorResolvable = isWin ? 'Green' : isLoss ? 'Red' : 'Yellow'
  const totalIcon = isWin ? '🟢' : isLoss ? '🔴' : '🟡'
  const totalAmount = isLoss
    ? `-${formatMoney(Math.abs(liveResult), globalSettings)}`
    : formatMoney(liveResult, globalSettings)

  const sections = [
    betLine(bet, globalSettings),
    `**Cards**\n${cardsLine(firstCard, secondCard)}`,
    `**Guess**\n${guessLabel(guess)} · **${formatMult(winMultiplier)}**`,
    `💰 Total: ${totalIcon} **${totalAmount}**`
  ]

  if (showBalance) {
    sections.push(
      `🏦 Balance: **${formatMoney(finalBalance, globalSettings)}**`
    )
  }

  return createBetEmbed(title, color, sections.join('\n\n'), betId)
}
