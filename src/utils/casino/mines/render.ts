import { formatMoney } from 'gambling-bot-shared/common'
import { type GlobalSettings } from 'gambling-bot-shared/guild'
import {
  MINES_COLS,
  MINES_ROWS,
  type MinesEngineState,
  currentMinesMultiplier
} from 'gambling-bot-shared/mines'

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable
} from 'discord.js'

import { createBetEmbed } from '@/utils/discord/createEmbed'

import { encodeId } from './customId'

export type MinesRenderResult =
  | { kind: 'ACTIVE' }
  | { kind: 'SAFE'; multiplier: number }
  | { kind: 'BUST' }
  | { kind: 'CASH_OUT'; multiplier: number; payout: number }
  | { kind: 'FORFEIT' }

/** Full board as tile grid for finished-game embeds (no buttons). */
export const formatMinesBoard = (state: MinesEngineState): string => {
  const revealed = new Set(state.revealedIndices)
  const mines = new Set(state.mineIndices)
  const lines: string[] = []

  for (let row = 0; row < MINES_ROWS; row++) {
    const cells: string[] = []
    for (let col = 0; col < MINES_COLS; col++) {
      const index = row * MINES_COLS + col
      if (mines.has(index)) cells.push('🟥')
      else if (revealed.has(index)) cells.push('🟩')
      else cells.push('⬛')
    }
    lines.push(cells.join(''))
  }

  return lines.join('\n')
}

export const renderMinesEmbed = ({
  betId,
  betAmount,
  mineCount,
  revealedCount,
  multiplier,
  result,
  board,
  showBalance,
  userBalance,
  globalSettings
}: {
  betId: string
  betAmount: number
  mineCount: number
  revealedCount: number
  multiplier: number
  result?: MinesRenderResult
  /** When set, board is shown in the embed (finished games). */
  board?: string
  showBalance?: boolean
  userBalance?: number
  globalSettings?: Partial<GlobalSettings> | null
}) => {
  let color: ColorResolvable = 'Blue'
  let resultText = 'Pick a tile. Cash out anytime after your first safe reveal.'

  if (result?.kind === 'SAFE') {
    color = 'Blue'
    resultText = `Safe! Current multiplier: **x${result.multiplier.toFixed(2)}**`
  } else if (result?.kind === 'BUST') {
    color = 'Red'
    resultText = `💥 Mine hit!\n💰 Total: 🔴 -**${formatMoney(betAmount, globalSettings)}**`
  } else if (result?.kind === 'CASH_OUT') {
    color = 'Green'
    const net = result.payout - betAmount
    resultText = `Cashed out at **x${result.multiplier.toFixed(2)}**!\n💰 Total: 🟢 **${formatMoney(net, globalSettings)}**`
  } else if (result?.kind === 'FORFEIT') {
    color = 'Red'
    resultText = `Game forfeited due to inactivity.\n💰 Total: 🔴 -**${formatMoney(betAmount, globalSettings)}**`
  } else if (result?.kind === 'ACTIVE' && revealedCount > 0) {
    resultText = `Current multiplier: **x${multiplier.toFixed(2)}**`
  }

  if (showBalance && typeof userBalance === 'number') {
    resultText += `\n🏦 Balance: **${formatMoney(userBalance, globalSettings)}**`
  }

  const sections = [
    `💵 Bet: **${formatMoney(betAmount, globalSettings)}**`,
    `💣 Mines: **${mineCount}** · Revealed: **${revealedCount}**`,
    ...(board ? [`**Board**\n${board}`] : []),
    `**Result**\n${resultText}`
  ]

  return createBetEmbed('💣 Mines', color, sections.join('\n\n'), betId)
}

export const renderMinesButtons = ({
  betId,
  state,
  showBalance
}: {
  betId: string
  state: MinesEngineState
  showBalance: boolean
}) => {
  const revealed = new Set(state.revealedIndices)
  const canCashOut = state.revealedIndices.length >= 1

  const rows: ActionRowBuilder<ButtonBuilder>[] = []

  for (let row = 0; row < MINES_ROWS; row++) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
    for (let col = 0; col < MINES_COLS; col++) {
      const index = row * MINES_COLS + col
      const isRevealed = revealed.has(index)

      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(
            encodeId({
              betId,
              action: { kind: 'cell', cellIndex: index },
              showBalance
            })
          )
          .setLabel(isRevealed ? '✅' : '⬛')
          .setStyle(isRevealed ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(isRevealed)
      )
    }
    rows.push(actionRow)
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          encodeId({
            betId,
            action: { kind: 'cashout' },
            showBalance
          })
        )
        .setLabel(
          canCashOut
            ? `Cash Out x${currentMinesMultiplier(state).toFixed(2)}`
            : 'Cash Out'
        )
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canCashOut)
    )
  )

  return rows
}
