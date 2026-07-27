import { formatMoney } from 'gambling-bot-shared/common'
import { type GlobalSettings } from 'gambling-bot-shared/guild'

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable
} from 'discord.js'

import { createBetEmbed } from '@/utils/discord/createEmbed'

import { encodeId } from './customId'
import { calculateHandValue } from './math'
import type {
  FinalGameResultId,
  GamePhaseId,
  PlayerAction,
  RenderParams,
  StartBlackjackResultId
} from './types'

const formatFinalResult = (
  result: FinalGameResultId,
  netProfit: number,
  globalSettings?: Partial<GlobalSettings> | null
): {
  color: ColorResolvable
  text: string
} => {
  switch (result) {
    case 'WIN':
      return {
        color: 'Green',
        text: `You win!\n💰 Total: 🟢 **${formatMoney(netProfit, globalSettings)}**`
      }

    case 'LOSS':
      return {
        color: 'Red',
        text: `You lose!\n💰 Total: 🔴 -**${formatMoney(Math.abs(netProfit), globalSettings)}**`
      }

    case 'EVEN':
      return {
        color: 'Yellow',
        text: `Break-even.\n💰 Total: 🟡 **${formatMoney(0, globalSettings)}**`
      }
  }
}

const formatPhaseResult = (
  result: GamePhaseId
): {
  color: ColorResolvable
  text: string
} => {
  switch (result) {
    case 'PLAYER_TURN':
      return {
        color: 'Blue',
        text: 'Player’s turn'
      }

    case 'DEALER_DRAWING':
      return {
        color: 'Yellow',
        text: 'Dealer’s turn'
      }
  }
}

const formatStartResult = (
  result: StartBlackjackResultId,
  totalBet: number,
  payout: number,
  globalSettings?: Partial<GlobalSettings> | null
): {
  color: ColorResolvable
  text: string
} => {
  switch (result) {
    case 'PBJ':
      return {
        color: 'Green',
        text: `You have Blackjack!\n💰 Total: 🟢 **${formatMoney(payout, globalSettings)}**`
      }

    case 'DBJ':
      return {
        color: 'Red',
        text: `Dealer has Blackjack!\n💰 Total: 🔴 -**${formatMoney(totalBet, globalSettings)}**`
      }

    case 'BBJ':
      return {
        color: 'Yellow',
        text: `Both have Blackjack.\n💰 Total: 🟡 **${formatMoney(0, globalSettings)}**`
      }
  }
}

export const renderBlackjackEmbed = ({
  hands,
  activeHandIndex,
  dealerCards,
  showBalance,
  userBalance,
  result,
  dealerHideSecondCard,
  betId,
  globalSettings
}: RenderParams) => {
  const playerHandsText = hands
    .map((hand, index) => {
      const total = calculateHandValue(hand.cards)
      const cards = hand.cards.map((c) => `${c.label}${c.suite}`).join(' ')
      const isActive = activeHandIndex !== -1 && index === activeHandIndex
      const busted = total > 21

      return [
        `**Hand ${index + 1}** ${isActive ? '👉 **ACTIVE**' : ''}`,
        `${cards} (**${total}**)${busted ? ' 💥 BUST' : ''}`,
        `💵 Bet: **${formatMoney(hand.betAmount, globalSettings)}**`
      ].join('\n')
    })
    .join('\n\n')

  const dealerTotal = calculateHandValue(dealerCards)

  const dealerHand = dealerHideSecondCard
    ? `${dealerCards[0].label}${dealerCards[0].suite} ??`
    : `${dealerCards
        .map((c) => `${c.label}${c.suite}`)
        .join(' ')} (**${dealerTotal}**)`

  let color: ColorResolvable = 'Yellow'
  let resultText = ''

  const totalBet = hands.reduce((sum, h) => sum + h.betAmount, 0)

  if (result) {
    switch (result.kind) {
      case 'START': {
        const formatted = formatStartResult(
          result.startResultId,
          totalBet,
          result.payout,
          globalSettings
        )
        color = formatted.color
        resultText = formatted.text
        break
      }

      case 'PHASE': {
        const formatted = formatPhaseResult(result.gamePhaseId)
        color = formatted.color
        resultText = formatted.text
        break
      }

      case 'FINAL': {
        const formatted = formatFinalResult(
          result.finalResultId,
          result.netProfit,
          globalSettings
        )
        color = formatted.color
        resultText = formatted.text
        break
      }
    }
  }

  const sections: string[] = [
    `💵 Total Bet: **${formatMoney(totalBet, globalSettings)}**`,
    `**Dealer**\n${dealerHand}`,
    `**You**\n${playerHandsText}`
  ]

  if (resultText) {
    let resultSection = `**Result**\n${resultText}`
    if (showBalance && typeof userBalance === 'number') {
      resultSection += `\n🏦 Balance: **${formatMoney(userBalance, globalSettings)}**`
    }
    sections.push(resultSection)
  }

  return createBetEmbed('🃏 Blackjack', color, sections.join('\n\n'), betId)
}

export const renderBlackjackButtons = ({
  betId,
  showBalance,
  canDouble,
  canSplit
}: {
  betId: string
  showBalance: boolean
  canDouble: boolean
  canSplit: boolean
}) => {
  const mk = (action: PlayerAction) =>
    encodeId({
      betId,
      action,
      showBalance
    })

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(mk('HIT'))
      .setLabel('Hit')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(mk('STAND'))
      .setLabel('Stand')
      .setStyle(ButtonStyle.Danger)
  )

  if (canDouble) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(mk('DOUBLE'))
        .setLabel('Double')
        .setStyle(ButtonStyle.Primary)
    )
  }

  if (canSplit) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(mk('SPLIT'))
        .setLabel('Split')
        .setStyle(ButtonStyle.Secondary)
    )
  }

  return row
}
