import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable
} from 'discord.js'

import { formatNumberToReadableString } from '@/utils/common/utils'
import { createBetEmbed } from '@/utils/discord/createEmbed'

import { encodeId } from './customId'
import { Card } from './deck'
import { PlayerAction } from './engine'
import { calculateHandValue } from './math'

export type RenderParams = {
  userId: string
  guildId: string
  betId: string
  betAmount: number
  playerCards: Card[]
  dealerCards: Card[]
  showBalance: boolean
  userBalance?: number
  resultId?: 'PB' | 'DB' | 'PW' | 'DW' | 'PUSH' | 'PBJ' | 'DBJ' | 'BBJ'
  dealerHideSecondCard?: boolean
}

export const renderBlackjackEmbed = ({
  betAmount,
  playerCards,
  dealerCards,
  showBalance,
  userBalance,
  resultId,
  dealerHideSecondCard,
  betId
}: RenderParams) => {
  const playerTotal = calculateHandValue(playerCards)
  const dealerTotal = calculateHandValue(dealerCards)

  const dealerHand = dealerHideSecondCard
    ? `${dealerCards[0].label}${dealerCards[0].suite} ??`
    : `${dealerCards
        .map((c) => `${c.label}${c.suite}`)
        .join(' ')} (**${dealerTotal}**)`

  let color: ColorResolvable = 'Yellow'
  let resultText = ''

  // TODO: Better result text
  switch (resultId) {
    case 'PBJ':
      color = 'Green'
      resultText = `You have Blackjack!\n💰 Total: 🟢 **$${formatNumberToReadableString(
        betAmount * 2.5
      )}**`
      break
    case 'DBJ':
      color = 'Red'
      resultText = `Dealer has Blackjack!\n💰 Total: 🔴 **$-${formatNumberToReadableString(
        betAmount
      )}**`
      break
    case 'BBJ':
      resultText = `You both have Blackjack!\n💰 Total: 🟡 **$${0}**`
      break
    case 'PB':
      color = 'Red'
      resultText = `You busted!\n💰 Total: 🔴 **$-${formatNumberToReadableString(betAmount)}**`
      break
    case 'DB':
      color = 'Green'
      resultText = `Dealer busted!\n💰 Total: 🟢 **$${formatNumberToReadableString(
        betAmount * 2
      )}**`
      break
    case 'PW':
      color = 'Green'
      resultText = `You win!\n💰 Total: 🟢 **$${formatNumberToReadableString(betAmount * 2)}**`
      break
    case 'DW':
      color = 'Red'
      resultText = `Dealer wins!\n💰 Total: 🔴 **$-${formatNumberToReadableString(betAmount)}**`
      break
    case 'PUSH':
      resultText = `It's a push!\n💰 Total: 🟡 **$${0}**`
      break
  }

  const sections: string[] = [
    `💵 Bet: **$${formatNumberToReadableString(betAmount)}**`,
    `**Dealer**\n${dealerHand}`,
    `**You**\n${playerCards
      .map((c) => `${c.label}${c.suite}`)
      .join(' ')} (**${playerTotal}**)`
  ]

  if (resultText) {
    let resultSection = `**Result**\n${resultText}`
    if (showBalance && typeof userBalance === 'number') {
      resultSection += `\n🏦 Balance: **$${formatNumberToReadableString(userBalance)}**`
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

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(mk('DEV-DELETE'))
      .setLabel('DELETE GAME FROM DB')
      .setStyle(ButtonStyle.Danger)
  )

  return row
}
