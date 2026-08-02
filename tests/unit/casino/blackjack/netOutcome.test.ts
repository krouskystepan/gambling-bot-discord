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
          cards: [card('6', 6, '♣️'), card('4', 4, '♥️'), card('Q', 10, '♦️')],
          betAmount: 2000,
          finished: true,
          isSplitHand: false
        }
      ],
      activeHandIndex: -1,
      dealerCards: [card('4', 4, '♦️'), card('7', 7, '♣️'), card('9', 9, '♦️')],
      showBalance: false,
      result: {
        kind: 'FINAL',
        finalResultId: 'WIN', // stale id must not override net
        netProfit: -200
      },
      sideBets: {
        pairsBet: 100,
        pairsOutcome: null,
        pairsPayout: 0,
        plusThreeBet: 100,
        plusThreeOutcome: null,
        plusThreePayout: 0,
        insuranceBet: null,
        insurancePayout: 0
      }
    })

    expect(embed.data.color).toBe(0xed4245) // Discord Red
    expect(embed.data.description).toContain('You lose!')
    expect(embed.data.description).toContain('🔴')
    expect(embed.data.description).not.toContain('You win!')
    expect(embed.data.description).not.toContain('🟢')
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
