import { MINI_NUMBERS } from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'
import type {
  RouletteSessionPhase,
  TRouletteSlipBet
} from 'gambling-bot-shared/roulette'

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js'

import { createBetEmbed } from '@/utils/discord/createEmbed'

import {
  ROULETTE_OUTSIDE_TARGETS,
  encodeActionId,
  encodePlaceId,
  encodeSelectId
} from './customId'
import { getRouletteColor } from './render'

type MoneySettings = Partial<GlobalSettings> | null | undefined

const OUTSIDE_LABELS: Record<
  (typeof ROULETTE_OUTSIDE_TARGETS)[number],
  string
> = {
  red: 'Red',
  black: 'Black',
  odd: 'Odd',
  even: 'Even',
  low: 'Low (1-9)',
  high: 'High (10-18)'
}

const miniWheelNumbers = Object.keys(MINI_NUMBERS)
  .map(Number)
  .filter((n) => n !== 0)
  .sort((a, b) => a - b)

const columnNumbers = (col: 1 | 2 | 3) =>
  miniWheelNumbers.filter((n) => ((n - 1) % 3) + 1 === col)

const dozenNumbers = (dozen: 1 | 2 | 3) =>
  miniWheelNumbers.filter((n) => Math.ceil(n / 6) === dozen)

const formatGroupLabel = (title: string, nums: number[]) =>
  `${title} (${nums.join(', ')})`.slice(0, 100)

export const slipTotal = (bets: TRouletteSlipBet[]) =>
  bets.reduce((sum, bet) => sum + bet.amount, 0)

export const formatSlipLines = (
  bets: TRouletteSlipBet[],
  globalSettings: MoneySettings
) => {
  if (bets.length === 0)
    return '_No bets yet - tap an outcome and enter an amount._'

  return bets
    .map(
      (bet) =>
        `• **${formatMoney(bet.amount, globalSettings)}** on **${bet.displayValue}**`
    )
    .join('\n')
}

export const renderRouletteTableEmbed = ({
  gameId,
  bets,
  phase,
  lastSpinResult,
  lastNetResult,
  showBalance,
  finalBalance,
  globalSettings
}: {
  gameId: string
  bets: TRouletteSlipBet[]
  phase: RouletteSessionPhase
  lastSpinResult?: string | null
  lastNetResult?: number | null
  showBalance: boolean
  finalBalance?: number
  globalSettings: MoneySettings
}) => {
  const total = slipTotal(bets)
  const lines = [
    `💵 Slip total: **${formatMoney(total, globalSettings)}**`,
    `**Bets**\n${formatSlipLines(bets, globalSettings)}`
  ]

  if (phase === 'result' && lastSpinResult != null) {
    const color = getRouletteColor(lastSpinResult)
    const net = lastNetResult ?? 0
    const netLabel = net > 0 ? '🟢' : net < 0 ? '🔴' : '🟡'
    lines.push(
      `🕹 Last spin: **${color} ${lastSpinResult}**`,
      `💰 Net: ${netLabel} **${formatMoney(net, globalSettings)}**`
    )
  }

  if (showBalance && finalBalance != null) {
    lines.push(`🏦 Balance: **${formatMoney(finalBalance, globalSettings)}**`)
  }

  if (phase === 'spinning') {
    lines.push('_This spin is being finalized. Buttons will return shortly._')
  } else if (phase === 'betting') {
    lines.push('_Tap an outcome, enter the amount, then press Spin._')
  } else {
    lines.push('_Rebet repeats your last slip, or Change bets to edit._')
  }

  return createBetEmbed(
    phase === 'result' ? '🌀 Roulette Result' : '🌀 Roulette Table',
    phase === 'result'
      ? (lastNetResult ?? 0) > 0
        ? 'Green'
        : (lastNetResult ?? 0) < 0
          ? 'Red'
          : 'Yellow'
      : 'Blue',
    lines.join('\n\n'),
    gameId
  )
}

export const renderRouletteClosedEmbed = () =>
  createBetEmbed(
    '🌀 Roulette Closed',
    'Grey',
    'This roulette table was closed.'
  )

export const renderRouletteTimeoutEmbed = ({
  autoClosed
}: {
  autoClosed?: boolean
} = {}) =>
  createBetEmbed(
    autoClosed ? '🌀 Roulette Timed Out' : '🌀 Roulette Closed',
    'Grey',
    autoClosed
      ? 'This table was closed after being idle too long.'
      : 'This roulette table was closed.'
  )

export const renderRouletteComponents = ({
  gameId,
  phase,
  hasBets,
  hasLastBets
}: {
  gameId: string
  phase: RouletteSessionPhase
  hasBets: boolean
  hasLastBets: boolean
}) => {
  if (phase === 'spinning') {
    return []
  }

  if (phase === 'result') {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            encodeActionId({ kind: 'action', gameId, action: 'rebet' })
          )
          .setLabel('Rebet')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!hasLastBets),
        new ButtonBuilder()
          .setCustomId(
            encodeActionId({ kind: 'action', gameId, action: 'change' })
          )
          .setLabel('Change bets')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(
            encodeActionId({ kind: 'action', gameId, action: 'close' })
          )
          .setLabel('Close')
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  }

  const placeButton = (
    target: (typeof ROULETTE_OUTSIDE_TARGETS)[number],
    style: ButtonStyle
  ) =>
    new ButtonBuilder()
      .setCustomId(encodePlaceId({ kind: 'place', gameId, target }))
      .setLabel(OUTSIDE_LABELS[target])
      .setStyle(style)

  const colorsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    placeButton('red', ButtonStyle.Danger),
    placeButton('black', ButtonStyle.Secondary)
  )

  const outsidesRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    placeButton('odd', ButtonStyle.Primary),
    placeButton('even', ButtonStyle.Primary),
    placeButton('low', ButtonStyle.Primary),
    placeButton('high', ButtonStyle.Primary)
  )

  // Discord max 5 rows - keep Undo/Clear/Spin/Close on one controls row.
  const controlsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'undo' }))
      .setLabel('Undo')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasBets),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'clear' }))
      .setLabel('Clear')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasBets),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'spin' }))
      .setLabel('Spin')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasBets),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'close' }))
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
  )

  const groupSelect =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeSelectId({ kind: 'select', gameId, select: 'group' })
        )
        .setPlaceholder('Dozen / Column')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(formatGroupLabel('Dozen 1', dozenNumbers(1)))
            .setValue('d1'),
          new StringSelectMenuOptionBuilder()
            .setLabel(formatGroupLabel('Dozen 2', dozenNumbers(2)))
            .setValue('d2'),
          new StringSelectMenuOptionBuilder()
            .setLabel(formatGroupLabel('Dozen 3', dozenNumbers(3)))
            .setValue('d3'),
          new StringSelectMenuOptionBuilder()
            .setLabel(formatGroupLabel('Column 1', columnNumbers(1)))
            .setValue('c1'),
          new StringSelectMenuOptionBuilder()
            .setLabel(formatGroupLabel('Column 2', columnNumbers(2)))
            .setValue('c2'),
          new StringSelectMenuOptionBuilder()
            .setLabel(formatGroupLabel('Column 3', columnNumbers(3)))
            .setValue('c3')
        )
    )

  const numberSelect =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeSelectId({ kind: 'select', gameId, select: 'number' })
        )
        .setPlaceholder('Straight number')
        .addOptions(
          ...Object.keys(MINI_NUMBERS)
            .sort((a, b) => Number(a) - Number(b))
            .map((n) => {
              const color = MINI_NUMBERS[n]!
              const colorLabel =
                color === 'red' ? 'Red' : color === 'black' ? 'Black' : 'Green'
              return new StringSelectMenuOptionBuilder()
                .setLabel(`${n} - ${colorLabel}`)
                .setValue(n)
            })
        )
    )

  return [colorsRow, outsidesRow, controlsRow, groupSelect, numberSelect]
}
