import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { describe, expect, it } from 'vitest'

import { renderHiloResultEmbed } from '@/utils/casino/hilo/render'

describe('renderHiloResultEmbed', () => {
  const base = {
    firstCard: '2♠️',
    secondCard: '6♥️',
    guess: 'higher' as const,
    winMultiplier: 0.9,
    bet: 500,
    showBalance: false,
    finalBalance: 0,
    betId: 'hilo-1',
    globalSettings: defaultGlobalSettings
  }

  it('shows a loss when the guess is correct but payout is under 1x', () => {
    const embed = renderHiloResultEmbed({
      ...base,
      liveResult: -50
    })

    expect(embed.data.title).toContain('Better Luck Next Time')
    expect(embed.data.color).toBe(0xed4245)
    expect(embed.data.description).toContain('🔴')
    expect(embed.data.description).toContain('-$50')
  })

  it('shows a win when liveResult is positive', () => {
    const embed = renderHiloResultEmbed({
      ...base,
      winMultiplier: 1.5,
      liveResult: 250
    })

    expect(embed.data.title).toContain('Win!')
    expect(embed.data.description).toContain('🟢')
  })

  it('shows a push when liveResult is zero', () => {
    const embed = renderHiloResultEmbed({
      ...base,
      winMultiplier: 1,
      liveResult: 0
    })

    expect(embed.data.title).toContain('Push!')
    expect(embed.data.description).toContain('🟡')
  })
})
