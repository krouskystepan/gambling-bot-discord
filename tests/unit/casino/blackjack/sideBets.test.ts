import { defaultCasinoSettings } from 'gambling-bot-shared/casino'
import { describe, expect, it } from 'vitest'

import {
  blackjackLockedTotal,
  computeBlackjackSidePayouts,
  sumHandBets
} from '@/utils/casino/blackjack/sideBets'

describe('blackjack side bets helpers', () => {
  it('sums hand bets and locked totals with sides', () => {
    expect(
      sumHandBets([
        {
          cards: [],
          betAmount: 100,
          finished: false,
          isSplitHand: false
        },
        {
          cards: [],
          betAmount: 100,
          finished: false,
          isSplitHand: true
        }
      ])
    ).toBe(200)

    expect(
      blackjackLockedTotal({
        hands: [
          {
            cards: [],
            betAmount: 100,
            finished: false,
            isSplitHand: false
          }
        ],
        activePairsBetAmount: 25,
        activePlusThreeBetAmount: 15,
        insuranceBetAmount: 50
      })
    ).toBe(190)
  })

  it('computes pairs, 21+3, and insurance payouts', () => {
    const { winMultipliers, pairsMultipliers, plusThreeMultipliers } =
      defaultCasinoSettings.blackjack

    expect(
      computeBlackjackSidePayouts({
        activePairsBetAmount: 10,
        pairsOutcome: 'perfect',
        activePlusThreeBetAmount: 10,
        plusThreeOutcome: 'flush',
        insuranceBetAmount: 50,
        dealerHasBlackjack: true,
        winMultipliers,
        pairsMultipliers,
        plusThreeMultipliers
      })
    ).toEqual({
      pairsPayout: 260,
      plusThreePayout: 60,
      insurancePayout: 150
    })

    expect(
      computeBlackjackSidePayouts({
        activePairsBetAmount: 10,
        pairsOutcome: 'loss',
        activePlusThreeBetAmount: 10,
        plusThreeOutcome: 'loss',
        insuranceBetAmount: 50,
        dealerHasBlackjack: false,
        winMultipliers,
        pairsMultipliers,
        plusThreeMultipliers
      })
    ).toEqual({ pairsPayout: 0, plusThreePayout: 0, insurancePayout: 0 })
  })
})
