import { Card } from '@/utils/casino/blackjack/deck'

export const card = (label: Card['label'], value: number): Card => ({
  suite: '♠️',
  label,
  value
})
