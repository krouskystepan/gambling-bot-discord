import type { Card } from 'gambling-bot-shared/blackjack'
import {
  BLACKJACK_DECK_DEFAULT,
  SUITES,
  VALUES
} from 'gambling-bot-shared/blackjack'

export { SUITES, VALUES } from 'gambling-bot-shared/blackjack'
export type { Card } from 'gambling-bot-shared/blackjack'

export const createDeck = (deckCount: number): Card[] =>
  Array.from({ length: deckCount }, () =>
    SUITES.flatMap((suite) =>
      VALUES.map(({ label, value }) => ({ suite, label, value }))
    )
  ).flat()

/** Default shoe used by sims/tests when no guild setting is available. */
export const DECK = createDeck(BLACKJACK_DECK_DEFAULT)
