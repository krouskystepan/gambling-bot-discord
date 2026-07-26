import { formatMoney } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'
import type { SlotsSessionPhase } from 'gambling-bot-shared/slots'

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js'

import { createBetEmbed } from '@/utils/discord/createEmbed'

import {
  SLOTS_MAX_SPINS,
  SLOTS_MIN_SPINS,
  encodeActionId,
  encodeSelectId
} from './customId'

type MoneySettings = Partial<GlobalSettings> | null | undefined

export const slotsBatchTotal = (
  unitBet: number | null | undefined,
  spinsCount: number
): number => {
  if (unitBet == null || !Number.isFinite(unitBet) || unitBet <= 0) return 0
  return unitBet * spinsCount
}

const netTone = (net: number) =>
  net > 0
    ? ('Green' as const)
    : net < 0
      ? ('Red' as const)
      : ('Yellow' as const)

const netEmoji = (net: number) => (net > 0 ? '🟢' : net < 0 ? '🔴' : '🟡')

export const renderSlotsMachineEmbed = ({
  gameId,
  phase,
  unitBet,
  spinsCount,
  lastNetResult,
  lastSpinsCount,
  lastTotalBet,
  lastWinsCount,
  showBalance,
  finalBalance,
  globalSettings
}: {
  gameId: string
  phase: SlotsSessionPhase
  unitBet: number | null
  spinsCount: number
  lastNetResult?: number | null
  lastSpinsCount?: number | null
  lastTotalBet?: number | null
  lastWinsCount?: number | null
  showBalance: boolean
  finalBalance?: number
  globalSettings: MoneySettings
}) => {
  const total = slotsBatchTotal(unitBet, spinsCount)

  const lines = [
    `💵 Chip: **${formatMoney(unitBet ?? 0, globalSettings)}**`,
    `🔄 Spins: **${spinsCount}**`,
    `💰 Total: **${formatMoney(total, globalSettings)}**`
  ]

  if (phase === 'result' && lastNetResult != null) {
    const net = lastNetResult
    const spins = lastSpinsCount ?? spinsCount
    const batchBet = lastTotalBet ?? total
    const wins = lastWinsCount ?? 0
    const losses = Math.max(0, spins - wins)

    lines.push(
      `📊 **${wins}** won / **${losses}** lost · bet **${formatMoney(batchBet, globalSettings)}**`,
      `💰 Net: ${netEmoji(net)} **${formatMoney(net, globalSettings)}**`
    )
  }

  if (showBalance && finalBalance != null) {
    lines.push(`🏦 Balance: **${formatMoney(finalBalance, globalSettings)}**`)
  }

  if (phase === 'ready') {
    lines.push(
      unitBet == null
        ? '_Set your chip with Change bet, pick spins, then Spin._'
        : '_Adjust chip or spins, then Spin._'
    )
  } else {
    lines.push('_Tweak chip or spins, then Spin again._')
  }

  return createBetEmbed(
    phase === 'result' ? '🎰 Slots Result' : '🎰 Slots Machine',
    phase === 'result' ? netTone(lastNetResult ?? 0) : 'Blue',
    lines.join('\n\n'),
    gameId
  )
}

export const renderSlotsClosedEmbed = () =>
  createBetEmbed('🎰 Slots Closed', 'Grey', 'This slots machine was closed.')

export const renderSlotsTimeoutEmbed = ({
  autoClosed
}: {
  autoClosed?: boolean
} = {}) =>
  createBetEmbed(
    autoClosed ? '🎰 Slots Timed Out' : '🎰 Slots Closed',
    'Grey',
    autoClosed
      ? 'This machine was closed after being idle too long.'
      : 'This slots machine was closed.'
  )

export const renderSlotsComponents = ({
  gameId,
  phase,
  hasUnitBet,
  spinsCount
}: {
  gameId: string
  phase: SlotsSessionPhase
  hasUnitBet: boolean
  spinsCount: number
}) => {
  const controlsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        encodeActionId({ kind: 'action', gameId, action: 'changeBet' })
      )
      .setLabel('Change bet')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'spin' }))
      .setLabel(phase === 'result' ? 'Spin again' : 'Spin')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasUnitBet),
    new ButtonBuilder()
      .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'close' }))
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
  )

  const spinsSelect =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeSelectId({ kind: 'select', gameId, select: 'spins' })
        )
        .setPlaceholder(`Spins: ${spinsCount}`)
        .addOptions(
          ...Array.from(
            { length: SLOTS_MAX_SPINS - SLOTS_MIN_SPINS + 1 },
            (_, i) => {
              const value = String(SLOTS_MIN_SPINS + i)
              return new StringSelectMenuOptionBuilder()
                .setLabel(`${value} spin${value === '1' ? '' : 's'}`)
                .setValue(value)
                .setDefault(Number(value) === spinsCount)
            }
          )
        )
    )

  return [controlsRow, spinsSelect]
}
