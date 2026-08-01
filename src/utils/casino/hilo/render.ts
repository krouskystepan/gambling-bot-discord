import type { HiloGuess } from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'

import type { ColorResolvable } from 'discord.js'

import { createBetEmbed } from '@/utils/discord/createEmbed'

type MoneySettings = Partial<GlobalSettings> | null | undefined

const formatMult = (mult: number | null) =>
  mult == null ? '—' : `${mult.toFixed(2)}x`

const guessLabel = (guess: HiloGuess) =>
  guess === 'higher' ? '⬆ Higher' : guess === 'lower' ? '⬇ Lower' : '↔ Draw'

/** Blackjack-style card string, e.g. `K♠️`. */
const cardsLine = (first: string, second: string) => `${first} → ${second}`

const betLine = (bet: number, globalSettings: MoneySettings) =>
  `💵 Bet: **${formatMoney(bet, globalSettings)}**`

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
  bet,
  timeoutFee,
  feeKept,
  refunded,
  betId,
  globalSettings
}: {
  firstCard: string
  bet: number
  timeoutFee: number
  feeKept: number
  refunded: number
  betId: string
  globalSettings: MoneySettings
}) =>
  createBetEmbed(
    '🃏 Hi-Lo - Timed Out',
    'Red',
    [
      betLine(bet, globalSettings),
      `**Card**\n${firstCard}`,
      `No guess in time - **${(timeoutFee * 100).toFixed(0)}%** timeout fee.`,
      `🔴 Kept: **${formatMoney(feeKept, globalSettings)}**\n🟢 Returned: **${formatMoney(refunded, globalSettings)}**`
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
  globalSettings
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
