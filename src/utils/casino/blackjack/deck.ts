import type { Card } from './types'

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
  { label: 'K', value: 10 }
] as const

const createDeck = (deckCount: number): Card[] =>
  Array.from({ length: deckCount }, () =>
    SUITES.flatMap((suite) =>
      VALUES.map(({ label, value }) => ({ suite, label, value }))
    )
  ).flat()

export const DECK = createDeck(2) // 2 decks
