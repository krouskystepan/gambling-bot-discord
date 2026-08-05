import {
  type CasinoSessionStats,
  PLINKO_ROW_COUNT,
  normalizePlinkoBinMultipliers
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'
import type { PlinkoSessionPhase } from 'gambling-bot-shared/plinko'

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

import { formatSessionSummaryEmbed } from '@/utils/casino/sessionSummary'
import { createBetEmbed } from '@/utils/discord/createEmbed'

import { type PlinkoDropAction, encodeActionId } from './customId'
import { renderBoardFrame } from './render'

type MoneySettings = Partial<GlobalSettings> | null | undefined

export const plinkoBatchTotal = (
  unitBet: number | null | undefined,
  ballsCount: number = 1
): number => {
  if (unitBet == null || !Number.isFinite(unitBet) || unitBet <= 0) return 0
  return unitBet * ballsCount
}

const netTone = (net: number) =>
  net > 0
    ? ('Green' as const)
    : net < 0
      ? ('Red' as const)
      : ('Yellow' as const)

const netEmoji = (net: number) => (net > 0 ? '🟢' : net < 0 ? '🔴' : '🟡')

const emptyBoardFrame = (
  binMultipliers?: Record<string | number, number | string> | null
) => {
  const multipliers = normalizePlinkoBinMultipliers(binMultipliers ?? {})
  return renderBoardFrame(PLINKO_ROW_COUNT, [], 0, 0, multipliers)
}

export const renderPlinkoBoardEmbed = ({
  gameId,
  phase,
  unitBet,
  lastNetResult,
  lastTotalBet,
  lastBallsCount,
  showBalance,
  finalBalance,
  globalSettings,
  binMultipliers
}: {
  gameId: string
  phase: PlinkoSessionPhase
  unitBet: number | null
  lastNetResult?: number | null
  lastTotalBet?: number | null
  lastBallsCount?: number | null
  showBalance: boolean
  finalBalance?: number
  globalSettings: MoneySettings
  binMultipliers?: Record<string | number, number | string> | null
}) => {
  const board = emptyBoardFrame(binMultipliers)

  const lines = [
    `💵 Bet: **${formatMoney(unitBet ?? 0, globalSettings)}**`,
    board
  ]

  if (phase === 'result' && lastNetResult != null) {
    const net = lastNetResult
    const balls = lastBallsCount ?? 1
    const batchBet = lastTotalBet ?? plinkoBatchTotal(unitBet, balls)
    const ballsLine = balls === 1 ? '🎯 Balls: **1**' : `🎯 Balls: **${balls}**`

    lines.push(
      [
        '💰 Last drop',
        `${netEmoji(net)} **${formatMoney(net, globalSettings)}**`,
        ballsLine,
        `💵 Bet: **${formatMoney(batchBet, globalSettings)}**`
      ].join('\n')
    )
  }

  if (showBalance && finalBalance != null) {
    lines.push(`🏦 Balance: **${formatMoney(finalBalance, globalSettings)}**`)
  }

  if (phase === 'ready') {
    lines.push(
      unitBet == null
        ? '_Set your bet with, then Drop._'
        : '_Drop x1 for one ball or more._'
    )
  } else if (phase === 'dropping') {
    lines.push('_Balls dropping..._')
  } else {
    lines.push('_Drop again, or Change bet._')
  }

  return createBetEmbed(
    phase === 'result' ? '🎯 Plinko Result' : '🎯 Plinko Board',
    phase === 'result' ? netTone(lastNetResult ?? 0) : 'Blue',
    lines.join('\n\n'),
    gameId
  )
}

export const renderPlinkoClosedEmbed = ({
  stats,
  gameId,
  globalSettings
}: {
  stats: CasinoSessionStats
  gameId?: string
  globalSettings?: MoneySettings
}) =>
  formatSessionSummaryEmbed({
    gameLabel: 'Plinko',
    emoji: '🎯',
    stats,
    reason: 'closed',
    gameId,
    globalSettings,
    roundsLabel: 'Drops'
  })

export const renderPlinkoTimeoutEmbed = ({
  stats,
  gameId,
  globalSettings,
  autoClosed
}: {
  stats: CasinoSessionStats
  gameId?: string
  globalSettings?: MoneySettings
  autoClosed?: boolean
}) =>
  formatSessionSummaryEmbed({
    gameLabel: 'Plinko',
    emoji: '🎯',
    stats,
    reason: autoClosed ? 'timeout' : 'closed',
    gameId,
    globalSettings,
    roundsLabel: 'Drops'
  })

const DROP_BUTTONS: { action: PlinkoDropAction; label: string }[] = [
  { action: 'drop1', label: 'Drop x1' },
  { action: 'drop5', label: 'Drop x5' },
  { action: 'drop10', label: 'Drop x10' }
]

export const renderPlinkoComponents = ({
  gameId,
  phase,
  hasUnitBet
}: {
  gameId: string
  phase: PlinkoSessionPhase
  hasUnitBet: boolean
}) => {
  if (phase === 'dropping') {
    return []
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          encodeActionId({ kind: 'action', gameId, action: 'changeBet' })
        )
        .setLabel('Change bet')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(
          encodeActionId({ kind: 'action', gameId, action: 'close' })
        )
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...DROP_BUTTONS.map(({ action, label }) =>
        new ButtonBuilder()
          .setCustomId(encodeActionId({ kind: 'action', gameId, action }))
          .setLabel(label)
          .setStyle(ButtonStyle.Success)
          .setDisabled(!hasUnitBet)
      )
    )
  ]
}
