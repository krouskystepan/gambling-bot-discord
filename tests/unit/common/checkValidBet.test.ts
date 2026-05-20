import { describe, expect, it } from 'vitest'

import { checkValidBet } from '@/utils/common/utils'

import { MessageFlags, createMockInteraction } from '../../helpers/discord-mock'

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
  })

  it('replies when bet exceeds maximum', () => {
    const interaction = createMockInteraction()

    expect(checkValidBet(interaction as never, 500, 100, 0)).toBe(false)
    expect(interaction.getLastReply()?.embeds).toBeDefined()
  })
})
