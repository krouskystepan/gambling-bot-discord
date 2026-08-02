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
import { blackjackFinalResultFromNet } from './netOutcome'
import { sumHandBets } from './sideBets'
import type {
  FinalGameResultId,
  GamePhaseId,
  InsuranceAction,
  PerfectPairsOutcome,
  PlayerAction,
  PlusThreeOutcome,
  RenderParams,
  SideBetSummary,
  StartBlackjackResultId
} from './types'

const formatPairsOutcome = (outcome: PerfectPairsOutcome): string => {
  switch (outcome) {
    case 'perfect':
      return 'Perfect Pair'
    case 'colored':
      return 'Colored Pair'
    case 'mixed':
      return 'Mixed Pair'
    case 'loss':
      return 'Lost'
    default: {
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}

const formatPlusThreeOutcome = (outcome: PlusThreeOutcome): string => {
  switch (outcome) {
    case 'suitedTrips':
      return 'Suited Trips'
    case 'straightFlush':
      return 'Straight Flush'
    case 'threeOfAKind':
      return 'Three of a Kind'
    case 'straight':
      return 'Straight'
    case 'flush':
      return 'Flush'
    case 'loss':
      return 'Lost'
    default: {
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}

const formatSideStakeLine = ({
  label,
  stake,
  outcomeLabel,
  payout,
  globalSettings
}: {
  label: string
  stake: number
  outcomeLabel?: string
  payout?: number
  globalSettings?: Partial<GlobalSettings> | null
}): string => {
  let line = outcomeLabel
    ? `${label}: **${formatMoney(stake, globalSettings)}** (${outcomeLabel})`
    : `${label}: **${formatMoney(stake, globalSettings)}**`
  if (typeof payout === 'number') {
    const net = payout - stake
    line +=
      net > 0
        ? ` → **${formatMoney(net, globalSettings)}**`
        : net === 0
          ? ' → push'
          : ` → -**${formatMoney(Math.abs(net), globalSettings)}**`
  }
  return line
}

const formatSideBetsSection = (
  sideBets: SideBetSummary | null | undefined,
  globalSettings?: Partial<GlobalSettings> | null
): string | null => {
  if (!sideBets) return null

  const lines: string[] = []

  if (sideBets.pairsBet != null && sideBets.pairsBet > 0) {
    lines.push(
      formatSideStakeLine({
        label: 'Pairs',
        stake: sideBets.pairsBet,
        outcomeLabel:
          sideBets.pairsOutcome != null
            ? formatPairsOutcome(sideBets.pairsOutcome)
            : 'Pending',
        payout:
          typeof sideBets.pairsPayout === 'number'
            ? sideBets.pairsPayout
            : undefined,
        globalSettings
      })
    )
  }

  if (sideBets.plusThreeBet != null && sideBets.plusThreeBet > 0) {
    lines.push(
      formatSideStakeLine({
        label: '21+3',
        stake: sideBets.plusThreeBet,
        outcomeLabel:
          sideBets.plusThreeOutcome != null
            ? formatPlusThreeOutcome(sideBets.plusThreeOutcome)
            : 'Pending',
        payout:
          typeof sideBets.plusThreePayout === 'number'
            ? sideBets.plusThreePayout
            : undefined,
        globalSettings
      })
    )
  }

  if (sideBets.insuranceBet != null && sideBets.insuranceBet > 0) {
    lines.push(
      formatSideStakeLine({
        label: 'Insurance',
        stake: sideBets.insuranceBet,
        payout:
          typeof sideBets.insurancePayout === 'number'
            ? sideBets.insurancePayout
            : undefined,
        globalSettings
      })
    )
  }

  return lines.length ? lines.join('\n') : null
}

const formatFinalResult = (
  _result: FinalGameResultId,
  netProfit: number,
  globalSettings?: Partial<GlobalSettings> | null
): {
  color: ColorResolvable
  text: string
} => {
  switch (blackjackFinalResultFromNet(netProfit)) {
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

    case 'INSURANCE_OFFER':
      return {
        color: 'Blue',
        text: 'Insurance? Dealer shows an Ace.'
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
  const net = payout - totalBet

  switch (result) {
    case 'PBJ':
      return {
        color: 'Green',
        text: `You have Blackjack!\n💰 Total: 🟢 **${formatMoney(net, globalSettings)}**`
      }

    case 'DBJ':
      return {
        color: net >= 0 ? 'Yellow' : 'Red',
        text:
          net >= 0
            ? `Dealer has Blackjack.\n💰 Total: 🟡 **${formatMoney(net, globalSettings)}**`
            : `Dealer has Blackjack!\n💰 Total: 🔴 -**${formatMoney(Math.abs(net), globalSettings)}**`
      }

    case 'BBJ':
      return {
        color: 'Yellow',
        text: `Both have Blackjack.\n💰 Total: 🟡 **${formatMoney(net, globalSettings)}**`
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
  gameId,
  sideBets,
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

  const mainBet = sumHandBets(hands)
  const totalBet =
    result?.kind === 'START'
      ? result.totalBet
      : mainBet +
        (sideBets?.pairsBet ?? 0) +
        (sideBets?.plusThreeBet ?? 0) +
        (sideBets?.insuranceBet ?? 0)

  if (result) {
    switch (result.kind) {
      case 'START': {
        const formatted = formatStartResult(
          result.startResultId,
          result.totalBet,
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

  const sideSection = formatSideBetsSection(sideBets, globalSettings)
  if (sideSection) {
    sections.push(`**Side bets**\n${sideSection}`)
  }

  if (resultText) {
    let resultSection = `**Result**\n${resultText}`
    if (showBalance && typeof userBalance === 'number') {
      resultSection += `\n🏦 Balance: **${formatMoney(userBalance, globalSettings)}**`
    }
    sections.push(resultSection)
  }

  if (result?.kind === 'FINAL' || result?.kind === 'START') {
    sections.push('_Rebet deals the same stake, or Change bet to edit._')
  }

  return createBetEmbed('🃏 Blackjack', color, sections.join('\n\n'), gameId)
}

export const renderBlackjackButtons = ({
  gameId,
  showBalance,
  canDouble,
  canSplit
}: {
  gameId: string
  showBalance: boolean
  canDouble: boolean
  canSplit: boolean
}) => {
  const mk = (action: PlayerAction) =>
    encodeId({
      gameId,
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

export const renderBlackjackInsuranceComponents = ({
  gameId,
  showBalance
}: {
  gameId: string
  showBalance: boolean
}) => {
  const mk = (action: InsuranceAction) =>
    encodeId({ gameId, action, showBalance })

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(mk('INSURE'))
        .setLabel('Insure')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(mk('NO_INSURE'))
        .setLabel('No insurance')
        .setStyle(ButtonStyle.Secondary)
    )
  ]
}

/** Between-hand controls shown while the session sits in `RESULT`. */
export const renderBlackjackResultComponents = ({
  gameId,
  showBalance
}: {
  gameId: string
  showBalance: boolean
}) => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeId({ gameId, action: 'REBET', showBalance }))
      .setLabel('Rebet')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(encodeId({ gameId, action: 'CHANGE', showBalance }))
      .setLabel('Change bet')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encodeId({ gameId, action: 'CLOSE', showBalance }))
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
  )
]

/** Pre-deal controls: set stake, then deal. */
export const renderBlackjackBettingEmbed = ({
  gameId,
  bet,
  pairsBet,
  plusThreeBet,
  pairsEnabled = true,
  plusThreeEnabled = true,
  globalSettings
}: {
  gameId: string
  bet: number | null
  pairsBet?: number | null
  plusThreeBet?: number | null
  pairsEnabled?: boolean
  plusThreeEnabled?: boolean
  globalSettings?: Partial<GlobalSettings> | null
}) => {
  const sections: string[] = []

  if (bet != null) {
    sections.push(`💵 **Main:** ${formatMoney(bet, globalSettings)}`)
  }

  if (pairsEnabled && pairsBet != null && pairsBet > 0) {
    sections.push(`**Pairs:** ${formatMoney(pairsBet, globalSettings)}`)
  }

  if (plusThreeEnabled && plusThreeBet != null && plusThreeBet > 0) {
    sections.push(`**21+3:** ${formatMoney(plusThreeBet, globalSettings)}`)
  }

  sections.push(
    bet == null
      ? '_Set your bet, then deal a hand._'
      : '_Deal a hand, or change your bet first._'
  )

  return createBetEmbed('🃏 Blackjack', 'Blue', sections.join('\n\n'), gameId)
}

export const renderBlackjackBettingComponents = ({
  gameId,
  showBalance,
  hasBet
}: {
  gameId: string
  showBalance: boolean
  hasBet: boolean
}) => [
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeId({ gameId, action: 'DEAL', showBalance }))
      .setLabel('Deal')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasBet),
    new ButtonBuilder()
      .setCustomId(encodeId({ gameId, action: 'CHANGE', showBalance }))
      .setLabel(hasBet ? 'Change bet' : 'Set bet')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encodeId({ gameId, action: 'CLOSE', showBalance }))
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
  )
]
