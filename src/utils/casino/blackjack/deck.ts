import type { Card } from 'gambling-bot-shared/blackjack'
import { SUITES, VALUES } from 'gambling-bot-shared/blackjack'

export { SUITES, VALUES } from 'gambling-bot-shared/blackjack'
export type { Card } from 'gambling-bot-shared/blackjack'

const createDeck = (deckCount: number): Card[] =>
  Array.from({ length: deckCount }, () =>
    SUITES.flatMap((suite) =>
      VALUES.map(({ label, value }) => ({ suite, label, value }))
    )
  ).flat()

export const DECK = createDeck(2) // 2 decks
