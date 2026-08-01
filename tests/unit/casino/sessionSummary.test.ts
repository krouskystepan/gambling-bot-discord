import { bumpSessionStats, emptySessionStats } from 'gambling-bot-shared/casino'
import { describe, expect, it } from 'vitest'

import { formatSessionSummaryEmbed } from '@/utils/casino/sessionSummary'

describe('formatSessionSummaryEmbed', () => {
  it('summarises a winning session that was closed by the player', () => {
    const stats = bumpSessionStats(emptySessionStats(), {
      totalBet: 100,
      totalPayout: 250
    })

    const embed = formatSessionSummaryEmbed({
      gameLabel: 'Blackjack',
      emoji: '🃏',
      stats,
      reason: 'closed',
      gameId: 'game-1',
      roundsLabel: 'Hands'
    })

    expect(embed.data.title).toBe('🃏 Blackjack Closed')
    expect(embed.data.description).toContain('Hands: **1**')
    expect(embed.data.description).toContain('🟢')
    expect(embed.data.description).toContain('_This session was closed._')
    expect(embed.data.footer?.text).toBe('ID: game-1')
  })

  it('marks timed out sessions and losing net profit', () => {
    const stats = bumpSessionStats(emptySessionStats(), {
      totalBet: 100,
      totalPayout: 0
    })

    const embed = formatSessionSummaryEmbed({
      gameLabel: 'Mines',
      stats,
      reason: 'timeout'
    })

    expect(embed.data.title).toBe('🎲 Mines Timed Out')
    expect(embed.data.description).toContain('🔴')
    expect(embed.data.description).toContain('idle too long')
  })

  it('uses a neutral marker for break-even sessions', () => {
    const embed = formatSessionSummaryEmbed({
      gameLabel: 'Baccarat',
      stats: emptySessionStats(),
      reason: 'closed'
    })

    expect(embed.data.description).toContain('🟡')
    expect(embed.data.description).toContain('Rounds: **0**')
  })
})
