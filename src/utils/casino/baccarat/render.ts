import {
  type BaccaratBetSide,
  type BaccaratCard,
  type BaccaratRoundResult,
  type BaccaratSlipBet,
  type BaccaratSlipLine,
  handTotal
} from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ColorResolvable
} from 'discord.js'

import { formatBaccaratCard } from '@/utils/casino/rng'
import { createBetEmbed } from '@/utils/discord/createEmbed'

import { encodeActionId, encodePlaceId } from './customId'
import { slipTotal } from './slip'

type MoneySettings = Partial<GlobalSettings> | null | undefined

export const BACCARAT_SIDE_LABELS: Record<BaccaratBetSide, string> = {
  player: 'Player',
  banker: 'Banker',
  tie: 'Tie',
  playerPair: 'Player Pair',
  bankerPair: 'Banker Pair',
  eitherPair: 'Either Pair',
  perfectPair: 'Perfect Pair',
  big: 'Big',
  small: 'Small',
  playerDragonBonus: 'Player Dragon',
  bankerDragonBonus: 'Banker Dragon',
  lucky6: 'Lucky 6'
}

const OUTCOME_LABELS = {
  player: 'Player',
  banker: 'Banker',
  tie: 'Tie'
} as const

export const formatBaccaratHand = (cards: BaccaratCard[], total: number) =>
  `${cards.map(formatBaccaratCard).join(' ')} (**${total}**)`

const formatMult = (mult: number) => `${Number(mult).toFixed(2)}x`

export const formatSlipLines = (
  bets: BaccaratSlipBet[],
  globalSettings: MoneySettings
) => {
  if (bets.length === 0)
    return '_No bets yet - tap a side and enter an amount._'

  return bets
    .map(
      (bet) =>
        `• **${formatMoney(bet.amount, globalSettings)}** on **${BACCARAT_SIDE_LABELS[bet.side]}**`
    )
    .join('\n')
}

const formatLineOutcome = (
  line: BaccaratSlipLine,
  globalSettings: MoneySettings
) => {
  const label = BACCARAT_SIDE_LABELS[line.side]
  const stake = formatMoney(line.amount, globalSettings)

  if (line.push) {
    return `• **${stake}** on **${label}** · Push (stake returned)`
  }

  if (line.won) {
    return `• **${stake}** on **${label}** · Won · **${formatMult(line.multiplier)}** · +${formatMoney(line.winnings - line.amount, globalSettings)}`
  }

  return `• **${stake}** on **${label}** · Lost`
}

export const renderBaccaratPromptEmbed = ({
  bets,
  gameId,
  globalSettings
}: {
  bets: BaccaratSlipBet[]
  gameId: string
  globalSettings: MoneySettings
}) => {
  const total = slipTotal(bets)

  return createBetEmbed(
    '🃏 Baccarat',
    'Blue',
    [
      `💵 Slip total: **${formatMoney(total, globalSettings)}**`,
      `**Bets**\n${formatSlipLines(bets, globalSettings)}`,
      '_Add bets, then Deal. Payouts: `/help` → Games._'
    ].join('\n\n'),
    gameId
  )
}

const placeButton = (
  gameId: string,
  side: BaccaratBetSide,
  style: ButtonStyle
) =>
  new ButtonBuilder()
    .setCustomId(encodePlaceId({ kind: 'place', gameId, side }))
    .setLabel(BACCARAT_SIDE_LABELS[side])
    .setStyle(style)

/** Side picks plus slip controls while building a bet slip. */
export const renderBaccaratButtons = ({
  gameId,
  hasBets,
  hasLastBets = false,
  phase = 'waiting'
}: {
  gameId: string
  hasBets: boolean
  hasLastBets?: boolean
  phase?: 'waiting' | 'result'
}) => {
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
          .setLabel('Change')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(
            encodeActionId({ kind: 'action', gameId, action: 'close' })
          )
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger)
      )
    ]
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      placeButton(gameId, 'player', ButtonStyle.Primary),
      placeButton(gameId, 'banker', ButtonStyle.Danger),
      placeButton(gameId, 'tie', ButtonStyle.Success)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      placeButton(gameId, 'playerPair', ButtonStyle.Secondary),
      placeButton(gameId, 'bankerPair', ButtonStyle.Secondary),
      placeButton(gameId, 'eitherPair', ButtonStyle.Secondary)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      placeButton(gameId, 'perfectPair', ButtonStyle.Secondary),
      placeButton(gameId, 'big', ButtonStyle.Secondary),
      placeButton(gameId, 'small', ButtonStyle.Secondary)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      placeButton(gameId, 'playerDragonBonus', ButtonStyle.Secondary),
      placeButton(gameId, 'bankerDragonBonus', ButtonStyle.Secondary),
      placeButton(gameId, 'lucky6', ButtonStyle.Secondary)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'deal' }))
        .setLabel('Deal')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!hasBets),
      new ButtonBuilder()
        .setCustomId(encodeActionId({ kind: 'action', gameId, action: 'undo' }))
        .setLabel('Undo')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasBets),
      new ButtonBuilder()
        .setCustomId(
          encodeActionId({ kind: 'action', gameId, action: 'clear' })
        )
        .setLabel('Clear')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasBets),
      new ButtonBuilder()
        .setCustomId(
          encodeActionId({ kind: 'action', gameId, action: 'close' })
        )
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger)
    )
  ]
}

/** Between-round controls shown once a round is settled. */
export const renderBaccaratResultComponents = ({
  gameId,
  canRebet
}: {
  gameId: string
  canRebet: boolean
}) =>
  renderBaccaratButtons({
    gameId,
    hasBets: false,
    hasLastBets: canRebet,
    phase: 'result'
  })

export const renderBaccaratDealEmbed = ({
  bets,
  playerCards,
  bankerCards,
  status,
  gameId,
  globalSettings
}: {
  bets: BaccaratSlipBet[]
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  status: string
  gameId: string
  globalSettings: MoneySettings
}) => {
  const total = slipTotal(bets)
  const lines = [
    `💵 Slip total: **${formatMoney(total, globalSettings)}**`,
    `**Bets**\n${formatSlipLines(bets, globalSettings)}`,
    playerCards.length
      ? `👤 Player: ${formatBaccaratHand(playerCards, handTotal(playerCards))}`
      : '👤 Player: ⏳',
    bankerCards.length
      ? `🏦 Banker: ${formatBaccaratHand(bankerCards, handTotal(bankerCards))}`
      : '🏦 Banker: ⏳',
    status
  ]

  return createBetEmbed('🃏 Dealing...', 'Yellow', lines.join('\n\n'), gameId)
}

export const renderBaccaratResultEmbed = ({
  round,
  lines,
  totalBet,
  totalWinnings,
  showBalance,
  finalBalance,
  gameId,
  globalSettings
}: {
  round: BaccaratRoundResult
  lines: BaccaratSlipLine[]
  totalBet: number
  totalWinnings: number
  showBalance: boolean | null
  finalBalance: number
  gameId: string
  globalSettings: MoneySettings
}) => {
  const liveResult = totalWinnings - totalBet
  const isWin = liveResult > 0
  const isLoss = liveResult < 0
  const allPush =
    lines.length > 0 && lines.every((line) => line.push) && liveResult === 0

  const title = allPush
    ? '🃏 **Push!** 🤝'
    : isWin
      ? '🃏 **Win!** 🎉'
      : '🃏 **Better Luck Next Time...** ❌'

  const color: ColorResolvable = allPush ? 'Yellow' : isWin ? 'Green' : 'Red'

  const totalIcon = allPush ? '🟡' : isWin ? '🟢' : '🔴'
  const totalAmount = isLoss
    ? `-${formatMoney(Math.abs(liveResult), globalSettings)}`
    : formatMoney(liveResult, globalSettings)

  const pairHints = [
    round.perfectPlayerPair
      ? 'Perfect Player Pair'
      : round.playerPair
        ? 'Player Pair'
        : null,
    round.perfectBankerPair
      ? 'Perfect Banker Pair'
      : round.bankerPair
        ? 'Banker Pair'
        : null,
    round.cardCount === 4
      ? 'Small (4 cards)'
      : round.cardCount >= 5
        ? `Big (${round.cardCount} cards)`
        : null
  ]
    .filter(Boolean)
    .join(' · ')

  const sections = [
    `💵 Slip total: **${formatMoney(totalBet, globalSettings)}**`,
    `**Outcomes**\n${lines.map((line) => formatLineOutcome(line, globalSettings)).join('\n')}`,
    `👤 Player: ${formatBaccaratHand(round.playerCards, round.playerTotal)}`,
    `🏦 Banker: ${formatBaccaratHand(round.bankerCards, round.bankerTotal)}`,
    `🏁 Outcome: **${OUTCOME_LABELS[round.outcome]}**${
      pairHints ? `\n🔗 ${pairHints}` : ''
    }`,
    `💰 Total: ${totalIcon} **${totalAmount}**`
  ]

  if (showBalance) {
    sections.push(
      `🏦 Balance: **${formatMoney(finalBalance, globalSettings)}**`
    )
  }

  sections.push('_Rebet repeats your last slip, or Change to edit._')

  return createBetEmbed(title, color, sections.join('\n\n'), gameId)
}
