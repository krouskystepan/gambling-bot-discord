import { defaultCasinoSettings } from 'gambling-bot-shared/casino'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

vi.mock('@/services/discord/announceBigWin.service', () => ({
  announceBigWin: vi.fn().mockResolvedValue(undefined)
}))

const { announceBigWin } =
  await import('@/services/discord/announceBigWin.service')

const baseConfig = {
  guildId: 'guild-1',
  winAnnouncementsChannelId: 'announce-ch',
  casinoSettings: defaultCasinoSettings
} as const

const guild = {
  id: 'guild-1',
  channels: { fetch: vi.fn() }
}

describe('tryAnnounceBigWin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does nothing when there are no lines', () => {
    tryAnnounceBigWin({
      guild,
      guildConfig: baseConfig as never,
      game: 'dice',
      lines: []
    })

    expect(announceBigWin).not.toHaveBeenCalled()
  })

  it('does nothing when guild is missing', () => {
    tryAnnounceBigWin({
      guild: null,
      guildConfig: baseConfig as never,
      game: 'dice',
      lines: ['line 1']
    })

    expect(announceBigWin).not.toHaveBeenCalled()
  })

  it('announces formatted message for the game', () => {
    tryAnnounceBigWin({
      guild,
      guildConfig: baseConfig as never,
      game: 'dice',
      lines: ['line 1', 'line 2'],
      betId: 'bet-1',
      sourceChannelId: 'source-ch'
    })

    expect(announceBigWin).toHaveBeenCalledWith({
      guild,
      guildConfig: baseConfig,
      message:
        '🎉 **Someone won big on Dice!**\n\nline 1\nline 2\n\n`ID: bet-1`',
      sourceChannelId: 'source-ch'
    })
  })
})
