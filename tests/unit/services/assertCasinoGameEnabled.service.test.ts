import { defaultCasinoSettings } from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { describe, expect, it, vi } from 'vitest'

import { assertCasinoGameEnabled } from '@/services/guild/assertCasinoGameEnabled.service'

import { createMockInteraction } from '../../helpers/discord-mock'

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string, description: string) => ({
    title,
    description
  })
}))

const baseConfig = (
  casinoSettings?: Partial<typeof defaultCasinoSettings>
): TGuildConfiguration =>
  ({
    guildId: 'g1',
    casinoSettings: { ...defaultCasinoSettings, ...casinoSettings }
  }) as TGuildConfiguration

const repliable = (opts?: { replied?: boolean; deferred?: boolean }) => {
  const mock = createMockInteraction()
  return {
    user: { id: 'user-1' },
    guild: null,
    replied: opts?.replied ?? false,
    deferred: opts?.deferred ?? false,
    reply: mock.reply,
    editReply: vi.fn().mockResolvedValue(undefined),
    getLastReply: mock.getLastReply
  }
}

describe('assertCasinoGameEnabled', () => {
  it('returns true when the game is enabled', async () => {
    const ix = repliable()
    await expect(
      assertCasinoGameEnabled(ix as never, baseConfig(), 'dice')
    ).resolves.toBe(true)
    expect(ix.reply).not.toHaveBeenCalled()
  })

  it('replies ephemeral and returns false when the game is disabled', async () => {
    const ix = repliable()
    const config = baseConfig({
      dice: { ...defaultCasinoSettings.dice, enabled: false }
    })

    await expect(
      assertCasinoGameEnabled(ix as never, config, 'dice')
    ).resolves.toBe(false)

    expect(ix.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            title: 'Error - Feature Disabled',
            description: 'Dice is disabled on this server.'
          })
        ]
      })
    )
  })

  it('uses editReply when the interaction was already deferred', async () => {
    const ix = repliable({ deferred: true })
    const config = baseConfig({
      blackjack: { ...defaultCasinoSettings.blackjack, enabled: false }
    })

    await expect(
      assertCasinoGameEnabled(ix as never, config, 'blackjack')
    ).resolves.toBe(false)

    expect(ix.editReply).toHaveBeenCalled()
    expect(ix.reply).not.toHaveBeenCalled()
  })
})
