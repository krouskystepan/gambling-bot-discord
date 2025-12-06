import { ColorResolvable, Message } from 'discord.js'
import { createBetEmbed } from './createEmbed'
import BlackjackGame from '../models/BlackjackGame'
import { drawNextCard } from './casinoHelpers'
import User from '../models/User'
import {
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from './utils'
import Transaction from '../models/Transaction'
import { TUser } from 'gambling-bot-shared'

export const SUITES = ['♠️', '♣️', '♥️', '♦️'] as const
export const VALUES = [
  { label: 'A', value: 11 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
  { label: '9', value: 9 },
  { label: '10', value: 10 },
  { label: 'J', value: 10 },
  { label: 'Q', value: 10 },
  { label: 'K', value: 10 },
] as const

export type Card = {
  suite: (typeof SUITES)[number]
  label: (typeof VALUES)[number]['label']
  value: (typeof VALUES)[number]['value']
}

export const DECK: Card[] = SUITES.flatMap((suite) =>
  VALUES.map(({ label, value }) => ({ suite, label, value }))
)

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export const calculateHandValue = (cards: Card[]): number => {
  let total = 0
  let aceCount = 0

  cards.forEach((card) => {
    if (card.label === 'A') {
      aceCount++
      total += 1
    } else {
      total += card.value
    }
  })

  while (aceCount > 0 && total + 10 <= 21) {
    total += 10
    aceCount--
  }

  return total
}

export const revealDealerCards = async (
  bet: string,
  message: Message<boolean>,
  dealerCards: Card[],
  dealerTotal: number,
  playerCards: Card[],
  playerTotal: number,
  deck: Card[],
  gameIndex: number,
  user: TUser,
  guildId: string,
  gameId: string,
  showBalnce: boolean,
  betId: string
) => {
  await message.edit({
    embeds: [
      createBlackjackEmbed(
        bet,
        dealerCards,
        dealerTotal,
        playerCards,
        playerTotal,
        'DRAWING',
        false,
        0,
        betId
      ),
    ],
    components: [],
  })

  await new Promise((resolve) => setTimeout(resolve, 1000))

  while (dealerTotal < 17) {
    const drawnCard = drawNextCard(deck, gameIndex)

    dealerCards.push(drawnCard)
    dealerTotal = calculateHandValue(dealerCards)
    gameIndex++

    await message.edit({
      embeds: [
        createBlackjackEmbed(
          bet,
          dealerCards,
          dealerTotal,
          playerCards,
          playerTotal,
          'DRAWING',
          false,
          0,
          betId
        ),
      ],
      components: [],
    })

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  const betAmount = parseReadableStringToNumber(bet)
  let resultId: BJResults
  let balanceChange = 0

  if (dealerTotal > 21) {
    resultId = 'DB'
    balanceChange = betAmount * 2
  } else if (dealerTotal === playerTotal) {
    resultId = 'PUSH'
    balanceChange = betAmount
  } else if (playerTotal > dealerTotal) {
    resultId = 'PW'
    balanceChange = betAmount * 2
  } else {
    resultId = 'DW'
    balanceChange = 0
  }

  if (balanceChange > 0) {
    const updatedUser = await User.findOneAndUpdate(
      { userId: user.userId, guildId },
      { $inc: { balance: balanceChange } },
      { new: true }
    )

    if (!updatedUser) throw new Error('User not found when paying out')

    await Transaction.create({
      userId: user.userId,
      guildId: user.guildId,
      amount: balanceChange,
      type: 'win',
      source: 'casino',
      betId,
      createdAt: new Date(),
    })

    user.balance = updatedUser.balance
  }

  await message.edit({
    embeds: [
      createBlackjackEmbed(
        bet,
        dealerCards,
        dealerTotal,
        playerCards,
        playerTotal,
        resultId,
        showBalnce,
        user.balance,
        betId
      ),
    ],
    components: [],
  })

  await BlackjackGame.findOneAndDelete({ userId: user.userId, guildId, gameId })
}

export type BJResults =
  | 'BBJ'
  | 'PBJ'
  | 'DBJ'
  | 'PB'
  | 'DB'
  | 'PW'
  | 'DW'
  | 'PUSH'
  | 'DRAWING'
  | undefined

export const createBlackjackEmbed = (
  bet: string,
  dealerCards: Card[],
  dealerTotal: number,
  playerCards: Card[],
  playerTotal: number,
  resultId: BJResults,
  showBalance: boolean,
  userBalance: number,
  betId: string,
  dealerVisibleOneCard: boolean = false
) => {
  const dealerHandText = dealerVisibleOneCard
    ? `${dealerCards[0].label}${dealerCards[0].suite} ??`
    : `${dealerCards
        .map((c) => `${c.label}${c.suite}`)
        .join(' ')} (**${dealerTotal}**)`

  let resultText = ''
  let color: ColorResolvable = 'Yellow'

  const betAmount = parseReadableStringToNumber(bet)

  switch (resultId) {
    case 'BBJ':
      resultText = `You both have Blackjack!\n💰 Total: 🟡 **$${0}**`
      break
    case 'PBJ':
      resultText = `You have Blackjack!\n💰 Total: 🟢 **$${formatNumberToReadableString(
        betAmount * 2.5
      )}**`
      color = 'Green'
      break
    case 'DBJ':
      resultText = `Dealer has Blackjack!\n💰 Total: 🔴 **$-${bet}**`
      color = 'Red'
      break
    case 'PB':
      resultText = `You busted!\n💰 Total: 🔴 **$-${bet}**`
      color = 'Red'
      break
    case 'DB':
      resultText = `Dealer busted!\n💰 Total: 🟢 **$${formatNumberToReadableString(
        betAmount * 2
      )}**`
      color = 'Green'
      break
    case 'PW':
      resultText = `You win!\n💰 Total: 🟢 **$${formatNumberToReadableString(
        betAmount * 2
      )}**`
      color = 'Green'
      break
    case 'DW':
      resultText = `Dealer wins!\n💰 Total: 🔴 **$-${bet}**`
      color = 'Red'
      break
    case 'PUSH':
      resultText = `It's a push!\n💰 Total: 🟡 **$${0}**`
      break
    case 'DRAWING':
      resultText = `Dealer is drawing...`
      break
    default:
      resultText = ''
      break
  }

  const sections = [
    `💵 Total Bet: **$${bet}**`,
    `**Dealer's Hand:**\n${dealerHandText}`,
    `**Your Hand:**\n${playerCards
      .map((c) => `${c.label}${c.suite}`)
      .join(' ')} (**${playerTotal}**)`,
  ]

  if (resultText) {
    let resultSection = `**Result**\n${resultText}`
    if (showBalance) {
      resultSection += `\n🏦 Balance: **$${formatNumberToReadableString(
        userBalance
      )}**`
    }
    sections.push(resultSection)
  } else if (showBalance) {
    sections.push(
      `🏦 Balance: **$${formatNumberToReadableString(userBalance)}**`
    )
  }

  return createBetEmbed('🃏 Blackjack', color, sections.join('\n\n'), betId)
}
