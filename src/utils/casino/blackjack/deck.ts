import type { Card } from 'gambling-bot-shared'
import { SUITES, VALUES } from 'gambling-bot-shared'

export { SUITES, VALUES } from 'gambling-bot-shared'
export type { Card } from 'gambling-bot-shared'

const createDeck = (deckCount: number): Card[] =>
  Array.from({ length: deckCount }, () =>
    SUITES.flatMap((suite) =>
      VALUES.map(({ label, value }) => ({ suite, label, value }))
    )
  ).flat()

export const DECK = createDeck(2) // 2 decks
