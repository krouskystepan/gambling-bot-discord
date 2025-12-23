import { Card } from './deck'

export const calculateHandValue = (cards: Card[]): number => {
  let total = 0
  let aces = 0

  for (const card of cards) {
    if (card.label === 'A') {
      aces++
      total += 1
    } else {
      total += card.value
    }
  }

  while (aces > 0 && total + 10 <= 21) {
    total += 10
    aces--
  }

  return total
}
