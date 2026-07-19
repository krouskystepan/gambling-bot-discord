import { describe, expect, it } from 'vitest'

import {
  formatBigWinLine,
  formatBigWinMessage
} from '@/utils/discord/formatBigWinMessage'

describe('formatBigWinMessage', () => {
  it('builds anonymous headline with result lines', () => {
    expect(
      formatBigWinMessage({
        game: 'dice',
        lines: ['Roll **1** - 🎲 - **x5.5** → **$5.5k** (bet **$1k**)']
      })
    ).toBe(
      '🎉 **Someone won big on Dice!**\n\nRoll **1** - 🎲 - **x5.5** → **$5.5k** (bet **$1k**)'
    )
  })

  it('appends bet id footer when provided', () => {
    expect(
      formatBigWinMessage({
        game: 'slots',
        lines: ['line 1'],
        betId: 'MQY906T40ICB3'
      })
    ).toBe('🎉 **Someone won big on Slots!**\n\nline 1\n\n`ID: MQY906T40ICB3`')
  })
})

describe('formatBigWinLine', () => {
  it('joins label, middle segments, multiplier, payout, and bet', () => {
    expect(
      formatBigWinLine({
        label: 'Roll **1**',
        middle: ['🎲'],
        multiplier: '5.5',
        payout: '$5.5k',
        bet: '$1k'
      })
    ).toBe('Roll **1** - 🎲 - **x5.5** → **$5.5k** (bet **$1k**)')
  })

  it('omits bet suffix when not provided', () => {
    expect(
      formatBigWinLine({
        label: 'Ball **1**',
        multiplier: '10',
        payout: '$1k'
      })
    ).toBe('Ball **1** - **x10** → **$1k**')
  })
})
