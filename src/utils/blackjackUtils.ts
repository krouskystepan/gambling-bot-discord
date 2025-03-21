import { ColorResolvable, Message } from 'discord.js'
import { createBetEmbed } from './createEmbed'
import BlackjackGame from '../models/BlackjackGame'
import { drawNextCard } from './casinoHelpers'
import { type User } from '../models/User'
import {
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from './utils'

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
  user: User,
  guildId: string,
  gameId: string,
  showBalance?: boolean
) => {
  await message.edit({
    embeds: [
      createBlackjackEmbed(
        bet,
        dealerCards,
        dealerTotal,
        playerCards,
        playerTotal,
        'Yellow',
        'Dealer is drawing...'
      ),
    ],
    components: [],
  })

  await new Promise((resolve) => setTimeout(resolve, 500))

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
          'Yellow',
          'Dealer is drawing...'
        ),
      ],
      components: [],
    })

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  const betAmount = parseReadableStringToNumber(bet)
  const result = { text: '', color: '' }

  if (dealerTotal > 21) {
    result.text = `Dealer busted!**\n💰 Total: 🟢 **$${bet}**`
    result.color = 'Green'

    user.balance += betAmount * 2
    await user.save()
  } else if (dealerTotal === playerTotal) {
    result.text = `It's a tie!**\n💰 Total: 🟡 **$${0}**`
    result.color = 'Yellow'

    user.balance += betAmount
    await user.save()
  } else if (playerTotal > dealerTotal) {
    result.text = `You win!**\n💰 Total: 🟢 **$-${bet}**`
    result.color = 'Green'

    user.balance += betAmount * 2
    await user.save()
  } else {
    result.text = `**Dealer wins!**\n💰 Total: 🔴 **$-${bet}**`
    result.color = 'Red'
  }

  await message.edit({
    embeds: [
      createBetEmbed(
        '🃏 Blackjack',
        result.color as ColorResolvable,
        [
          `**Dealer's Hand:**\n${dealerCards
            .map((c) => `${c.label}${c.suite}`)
            .join(' ')} (**${dealerTotal}**)`,
          `**Your Hand:**\n${playerCards
            .map((c) => `${c.label}${c.suite}`)
            .join(' ')} (**${playerTotal}**)`,
          `**Result:**\n${result.text}`,
        ].join('\n\n')
      ),
    ],
    components: [],
  })

  await BlackjackGame.findOneAndDelete({ userId: user.userId, guildId, gameId })
}

export const createBlackjackEmbed = (
  bet: string,
  dealerCards: Card[],
  dealerTotal: number,
  playerCards: Card[],
  playerTotal: number,
  color: ColorResolvable,
  resultText?: string,
  dealerVisibleOneCard: boolean = false
) => {
  const dealerHandText = dealerVisibleOneCard
    ? `${dealerCards[0].label}${dealerCards[0].suite} ??`
    : `${dealerCards
        .map((c) => `${c.label}${c.suite}`)
        .join(' ')} (**${dealerTotal}**)`

  return createBetEmbed(
    '🃏 Blackjack',
    color,
    [
      `💵 Total Bet: **$${bet}**`,
      `**Dealer's Hand:**\n${dealerHandText}`,
      `**Your Hand:**\n${playerCards
        .map((c) => `${c.label}${c.suite}`)
        .join(' ')} (**${playerTotal}**)`,
      resultText ? `${resultText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  )
}
