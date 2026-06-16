import { defaultCasinoSettings } from 'gambling-bot-shared/casino'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { announceBigWin } from '@/services/discord/announceBigWin.service'

vi.mock('@/utils/discord/createEmbed', () => ({
  createBetEmbed: vi.fn(() => ({ title: 'embed' }))
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn() }
}))

const { createBetEmbed } = await import('@/utils/discord/createEmbed')
const { logger } = await import('@/utils/logger')

const baseConfig = {
  guildId: 'guild-1',
  winAnnouncementsChannelId: 'announce-ch',
  casinoSettings: defaultCasinoSettings
} as const

describe('announceBigWin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('skips when announcements channel is unset', async () => {
    const send = vi.fn()
    const guild = {
      id: 'guild-1',
      channels: { fetch: vi.fn() }
    }

    await announceBigWin({
      guild: guild as never,
      guildConfig: { ...baseConfig, winAnnouncementsChannelId: '' } as never,
      userId: 'user-1',
      title: 'Win',
      description: 'Big win'
    })

    expect(guild.channels.fetch).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('skips when source channel matches announcements channel', async () => {
    const guild = {
      id: 'guild-1',
      channels: { fetch: vi.fn() }
    }

    await announceBigWin({
      guild: guild as never,
      guildConfig: baseConfig as never,
      userId: 'user-1',
      title: 'Win',
      description: 'Big win',
      sourceChannelId: 'announce-ch'
    })

    expect(guild.channels.fetch).not.toHaveBeenCalled()
  })

  it('skips when fetched channel is not sendable', async () => {
    const guild = {
      id: 'guild-1',
      channels: {
        fetch: vi.fn().mockResolvedValue({ guild: { id: 'guild-1' } })
      }
    }

    await announceBigWin({
      guild: guild as never,
      guildConfig: baseConfig as never,
      userId: 'user-1',
      title: 'Win',
      description: 'Big win'
    })

    expect(guild.channels.fetch).toHaveBeenCalledWith('announce-ch')
    expect(createBetEmbed).not.toHaveBeenCalled()
  })

  it('skips when channel fetch fails', async () => {
    const guild = {
      id: 'guild-1',
      channels: {
        fetch: vi.fn().mockRejectedValue(new Error('fetch failed'))
      }
    }

    await announceBigWin({
      guild: guild as never,
      guildConfig: baseConfig as never,
      userId: 'user-1',
      title: 'Win',
      description: 'Big win'
    })

    expect(createBetEmbed).not.toHaveBeenCalled()
  })

  it('sends embed when channel is configured and sendable', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const guild = {
      id: 'guild-1',
      channels: {
        fetch: vi.fn().mockResolvedValue({
          send,
          guild: { id: 'guild-1' }
        })
      }
    }

    await announceBigWin({
      guild: guild as never,
      guildConfig: baseConfig as never,
      userId: 'user-1',
      title: '🏆 Golden Jackpot!',
      description: 'hit the jackpot',
      betId: 'bet-1'
    })

    expect(createBetEmbed).toHaveBeenCalledWith(
      '🏆 Golden Jackpot!',
      'Gold',
      'hit the jackpot',
      'bet-1'
    )
    expect(send).toHaveBeenCalledWith({
      content: '<@user-1>',
      embeds: [{ title: 'embed' }]
    })
  })

  it('logs when send fails', async () => {
    const sendError = new Error('send failed')
    const send = vi.fn().mockRejectedValue(sendError)
    const guild = {
      id: 'guild-1',
      channels: {
        fetch: vi.fn().mockResolvedValue({
          send,
          guild: { id: 'guild-1' }
        })
      }
    }

    await announceBigWin({
      guild: guild as never,
      guildConfig: baseConfig as never,
      userId: 'user-1',
      title: 'Win',
      description: 'Big win'
    })

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        { err: sendError, guildId: 'guild-1', channelId: 'announce-ch' },
        'Failed to send big win announcement'
      )
    })
  })
})
