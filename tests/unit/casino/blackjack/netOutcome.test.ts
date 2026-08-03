import { describe, expect, it } from 'vitest'

import { blackjackFinalResultFromNet } from '@/utils/casino/blackjack/netOutcome'
import { renderBlackjackEmbed } from '@/utils/casino/blackjack/render'
import type { Card } from '@/utils/casino/blackjack/types'

const card = (
  label: Card['label'],
  value: number,
  suite: Card['suite'] = '♠️'
): Card => ({ label, value, suite })

describe('blackjackFinalResultFromNet', () => {
  it('classifies by net of main + side bets', () => {
    expect(blackjackFinalResultFromNet(200)).toBe('WIN')
    expect(blackjackFinalResultFromNet(0)).toBe('EVEN')
    // Main push + lost sides (e.g. double to 2k, sides 200).
    expect(blackjackFinalResultFromNet(-200)).toBe('LOSS')
    expect(blackjackFinalResultFromNet(Number.NaN)).toBe('EVEN')
  })
})

describe('renderBlackjackEmbed final net', () => {
  it('shows a red loss for push main with lost side bets', () => {
    const embed = renderBlackjackEmbed({
      userId: 'u',
      guildId: 'g',
      gameId: 'blackjack-test',
      hands: [
        {
          cards: [
            card('3', 3),
            card('9', 9, '♦️'),
            card('8', 8, '♦️')
          ],
          betAmount: 2500,
          finished: true,
          isSplitHand: false
        }
      ],
      activeHandIndex: -1,
      dealerCards: [card('10', 10, '♦️'), card('J', 10)],
      showBalance: false,
      result: {
        kind: 'FINAL',
        finalResultId: 'WIN', // stale id must not override net
        netProfit: -400
      },
      sideBets: {
        pairsBet: 200,
        pairsOutcome: 'loss',
        pairsPayout: 0,
        plusThreeBet: 200,
        plusThreeOutcome: 'loss',
        plusThreePayout: 0,
        insuranceBet: null,
        insurancePayout: 0
      }
    })

    const description = embed.data.description ?? ''
    const sideSection = description.split('**Result**')[0] ?? description

    expect(embed.data.color).toBe(0xed4245) // Discord Red
    expect(description).toContain('· Push')
    expect(description).toContain('You lose!')
    expect(description).toMatch(/Total: 🔴 -/)
    expect(description).not.toContain('You win!')
    expect(description).not.toMatch(/Total: 🟢/)
    expect(sideSection).toMatch(/Pairs:.*\(Lost\) → -/)
    expect(sideSection).toMatch(/21\+3:.*\(Lost\) → -/)
    expect(sideSection).not.toContain('🔴')
    expect(sideSection).not.toContain('🟢')
  })

  it('labels split hand outcomes and shows a loss for lose+push', () => {
    const embed = renderBlackjackEmbed({
      userId: 'u',
      guildId: 'g',
      gameId: 'blackjack-test',
      hands: [
        {
          cards: [card('7', 7), card('7', 7)],
          betAmount: 1000,
          finished: true,
          isSplitHand: true
        },
        {
          cards: [card('7', 7), card('7', 7), card('7', 7)],
          betAmount: 2000,
          finished: true,
          isSplitHand: true
        }
      ],
      activeHandIndex: -1,
      dealerCards: [card('9', 9), card('5', 5), card('7', 7)],
      showBalance: false,
      result: {
        kind: 'FINAL',
        finalResultId: 'WIN', // stale id must not override net
        netProfit: -1000
      }
    })

    expect(embed.data.color).toBe(0xed4245)
    expect(embed.data.description).toContain('You lose!')
    expect(embed.data.description).toContain('· Lost')
    expect(embed.data.description).toContain('· Push')
    expect(embed.data.description).not.toContain('You win!')
  })

  it('shows Bust instead of Lost+BUST for a busted hand', () => {
    const embed = renderBlackjackEmbed({
      userId: 'u',
      guildId: 'g',
      gameId: 'blackjack-test',
      hands: [
        {
          cards: [card('10', 10), card('10', 10), card('5', 5)],
          betAmount: 100,
          finished: true,
          isSplitHand: false
        }
      ],
      activeHandIndex: -1,
      dealerCards: [card('10', 10), card('8', 8)],
      showBalance: false,
      result: {
        kind: 'FINAL',
        finalResultId: 'LOSS',
        netProfit: -100
      }
    })

    expect(embed.data.description).toContain('· Bust')
    expect(embed.data.description).not.toContain('· Lost')
  })

  it('formats insurance like other side bets', () => {
    const embed = renderBlackjackEmbed({
      userId: 'u',
      guildId: 'g',
      gameId: 'blackjack-test',
      hands: [
        {
          cards: [card('10', 10), card('9', 9)],
          betAmount: 100,
          finished: true,
          isSplitHand: false
        }
      ],
      activeHandIndex: -1,
      dealerCards: [card('A', 11), card('10', 10)],
      showBalance: false,
      result: {
        kind: 'FINAL',
        finalResultId: 'LOSS',
        netProfit: -150
      },
      sideBets: {
        pairsBet: null,
        pairsOutcome: null,
        plusThreeBet: null,
        plusThreeOutcome: null,
        insuranceBet: 50,
        insurancePayout: 0
      }
    })

    expect(embed.data.description).toMatch(/Insurance:.*\(Lost\)/)
  })

  it('does not put win/lose circle emotes on side-bet lines', () => {
    const embed = renderBlackjackEmbed({
      userId: 'u',
      guildId: 'g',
      gameId: 'blackjack-test',
      hands: [
        {
          cards: [card('6', 6), card('4', 4)],
          betAmount: 100,
          finished: true,
          isSplitHand: false
        }
      ],
      activeHandIndex: -1,
      dealerCards: [card('4', 4), card('7', 7)],
      showBalance: false,
      result: {
        kind: 'FINAL',
        finalResultId: 'LOSS',
        netProfit: -200
      },
      sideBets: {
        pairsBet: 100,
        pairsOutcome: 'loss',
        pairsPayout: 0,
        plusThreeBet: 100,
        plusThreeOutcome: 'loss',
        plusThreePayout: 0,
        insuranceBet: null,
        insurancePayout: 0
      }
    })

    const description = embed.data.description ?? ''
    const sideSection = description.split('**Result**')[0] ?? description

    expect(sideSection).toContain('Pairs:')
    expect(sideSection).toContain('21+3:')
    expect(sideSection).toMatch(/Pairs:.*→ -/)
    expect(sideSection).toMatch(/21\+3:.*→ -/)
    expect(sideSection).not.toContain('🔴')
    expect(sideSection).not.toContain('🟢')
    expect(sideSection).not.toContain('🟡')
  })
})
