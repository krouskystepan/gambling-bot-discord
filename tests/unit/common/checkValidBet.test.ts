import { describe, expect, it } from 'vitest'

import { Colors } from 'discord.js'

import { checkValidBet } from '@/utils/common/utils'

import { MessageFlags, createMockInteraction } from '../../helpers/discord-mock'

const embedTitle = (interaction: ReturnType<typeof createMockInteraction>) => {
  const embed = interaction.getLastReply()?.embeds?.[0]
  return embed && 'data' in embed ? embed.data?.title : undefined
}

const embedColor = (interaction: ReturnType<typeof createMockInteraction>) => {
  const embed = interaction.getLastReply()?.embeds?.[0]
  return embed && 'data' in embed ? embed.data?.color : undefined
}

describe('checkValidBet', () => {
  it('returns true for valid bet without replying', () => {
    const interaction = createMockInteraction()

    expect(checkValidBet(interaction as never, 100, 1000, 10)).toBe(true)
    expect(interaction.reply).not.toHaveBeenCalled()
  })

  it('replies and returns false for invalid bet', () => {
    const interaction = createMockInteraction()

    expect(checkValidBet(interaction as never, 0.001, 0, 0)).toBe(false)
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ flags: MessageFlags.Ephemeral })
    )
    expect(embedColor(interaction)).toBe(Colors.Red)
  })

  it('replies when bet exceeds maximum', () => {
    const interaction = createMockInteraction()

    expect(checkValidBet(interaction as never, 500, 100, 0)).toBe(false)
    expect(interaction.getLastReply()?.embeds).toBeDefined()
  })

  it('replies for invalid number', () => {
    const interaction = createMockInteraction()
    expect(checkValidBet(interaction as never, NaN, 1000, 0)).toBe(false)
    expect(embedTitle(interaction)).toContain('Invalid Input')
  })

  it('replies for too many decimals', () => {
    const interaction = createMockInteraction()
    expect(checkValidBet(interaction as never, 10.001, 1000, 0)).toBe(false)
    expect(embedTitle(interaction)).toContain('Invalid Bet Amount')
  })

  it('replies for below global minimum', () => {
    const interaction = createMockInteraction()
    expect(checkValidBet(interaction as never, 0.5, 1000, 0)).toBe(false)
  })

  it('replies for below configured min bet', () => {
    const interaction = createMockInteraction()
    expect(checkValidBet(interaction as never, 5, 1000, 10)).toBe(false)
    expect(embedTitle(interaction)).toContain('Below Minimum Bet')
  })
})
