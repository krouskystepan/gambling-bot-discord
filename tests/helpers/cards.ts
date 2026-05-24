import type { Card } from '@/utils/casino/blackjack/types'

export const card = (label: Card['label'], value: number): Card => ({
  suite: '♠️',
  label,
  value
})
