import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { describe, expect, it, vi } from 'vitest'

import {
  replyBetValidationError,
  replyEphemeralError
} from '@/utils/casino/betValidationReply'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

const makeInteraction = ({
  repliable = true,
  deferred = false,
  replied = false
}: {
  repliable?: boolean
  deferred?: boolean
  replied?: boolean
} = {}) => ({
  isRepliable: () => repliable,
  deferred,
  replied,
  reply: vi.fn().mockResolvedValue(undefined),
  followUp: vi.fn().mockResolvedValue(undefined)
})

const replyDescription = async (error: string) => {
  const interaction = makeInteraction()

  await replyBetValidationError(
    interaction as never,
    error,
    5000,
    10,
    defaultGlobalSettings
  )

  return interaction.reply.mock.calls[0]?.[0].embeds[0].data.description
}

describe('replyBetValidationError', () => {
  it('explains each validation failure', async () => {
    expect(await replyDescription('INVALID_NUMBER')).toContain('valid number')
    expect(await replyDescription('TOO_MANY_DECIMALS')).toContain(
      '2 decimal places'
    )
    expect(await replyDescription('BELOW_MINIMUM')).toContain('**$1**')
    expect(await replyDescription('ABOVE_MAXIMUM')).toContain('Maximum bet')
    expect(await replyDescription('BELOW_MIN_BET')).toContain('Minimum bet')
    expect(await replyDescription('SOMETHING_ELSE')).toContain(
      'Bet amount is invalid.'
    )
  })

  it('does nothing when the interaction cannot be replied to', async () => {
    const interaction = makeInteraction({ repliable: false })

    await replyBetValidationError(
      interaction as never,
      'INVALID_NUMBER',
      5000,
      10,
      defaultGlobalSettings
    )

    expect(interaction.reply).not.toHaveBeenCalled()
    expect(interaction.followUp).not.toHaveBeenCalled()
  })

  it('uses followUp when the interaction is already deferred', async () => {
    const interaction = makeInteraction({ deferred: true })

    await replyBetValidationError(
      interaction as never,
      'INVALID_NUMBER',
      5000,
      10,
      defaultGlobalSettings
    )

    expect(interaction.reply).not.toHaveBeenCalled()
    expect(interaction.followUp).toHaveBeenCalledTimes(1)
  })
})

describe('replyEphemeralError', () => {
  it('replies when not yet acknowledged', async () => {
    const interaction = makeInteraction()
    const embeds = [createErrorEmbed('Title', 'Body')]

    await replyEphemeralError(interaction as never, embeds)

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds })
    )
  })

  it('follows up when already deferred', async () => {
    const interaction = makeInteraction({ deferred: true })
    const embeds = [createErrorEmbed('Title', 'Body')]

    await replyEphemeralError(interaction as never, embeds)

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ embeds })
    )
  })
})
