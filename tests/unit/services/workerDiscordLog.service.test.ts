import { Colors } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'

vi.mock('@/services', () => ({
  getGuildConfigByGuildId: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn() }
}))

const { getGuildConfigByGuildId } = await import('@/services')
const { logger } = await import('@/utils/logger')

const basePayload = {
  guildId: 'guild-1',
  worker: 'VIP expiration',
  title: 'Processed 2 room(s)',
  description: 'Roles removed and VIP channels expired.'
} as const

describe('postWorkerLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('skips when worker log channel is unset', async () => {
    vi.mocked(getGuildConfigByGuildId).mockResolvedValue({
      workerLogChannelId: ''
    } as never)

    const client = {
      guilds: { fetch: vi.fn() }
    }

    await postWorkerLog(client as never, basePayload)

    expect(client.guilds.fetch).not.toHaveBeenCalled()
  })

  it('skips when guild config is missing', async () => {
    vi.mocked(getGuildConfigByGuildId).mockResolvedValue(null)

    const client = {
      guilds: { fetch: vi.fn() }
    }

    await postWorkerLog(client as never, basePayload)

    expect(client.guilds.fetch).not.toHaveBeenCalled()
  })

  it('logs when channel is not sendable', async () => {
    vi.mocked(getGuildConfigByGuildId).mockResolvedValue({
      workerLogChannelId: 'worker-log-ch'
    } as never)

    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          id: 'guild-1',
          channels: {
            fetch: vi.fn().mockResolvedValue({ guild: { id: 'guild-1' } })
          }
        })
      }
    }

    await postWorkerLog(client as never, basePayload)

    expect(logger.error).toHaveBeenCalledWith(
      { channelId: 'worker-log-ch', guildId: 'guild-1' },
      'Worker log channel not sendable'
    )
  })

  it('sends embed when channel is configured and sendable', async () => {
    vi.mocked(getGuildConfigByGuildId).mockResolvedValue({
      workerLogChannelId: 'worker-log-ch'
    } as never)

    const send = vi.fn().mockResolvedValue(undefined)
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          id: 'guild-1',
          channels: {
            fetch: vi.fn().mockResolvedValue({
              send,
              guild: { id: 'guild-1' }
            })
          }
        })
      }
    }

    await postWorkerLog(client as never, basePayload)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].embeds).toHaveLength(1)
    expect(send.mock.calls[0][0].embeds[0].data.timestamp).toBeDefined()
  })

  it('skips when channel fetch fails', async () => {
    vi.mocked(getGuildConfigByGuildId).mockResolvedValue({
      workerLogChannelId: 'worker-log-ch'
    } as never)

    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          id: 'guild-1',
          channels: {
            fetch: vi.fn().mockRejectedValue(new Error('channel missing'))
          }
        })
      }
    }

    await postWorkerLog(client as never, basePayload)

    expect(client.guilds.fetch).toHaveBeenCalledWith('guild-1')
  })

  it('skips when guild is missing', async () => {
    vi.mocked(getGuildConfigByGuildId).mockResolvedValue({
      workerLogChannelId: 'worker-log-ch'
    } as never)

    const send = vi.fn()
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue(null)
      }
    }

    await postWorkerLog(client as never, basePayload)

    expect(send).not.toHaveBeenCalled()
  })

  it('skips when guild fetch fails', async () => {
    vi.mocked(getGuildConfigByGuildId).mockResolvedValue({
      workerLogChannelId: 'worker-log-ch'
    } as never)

    const client = {
      guilds: {
        fetch: vi.fn().mockRejectedValue(new Error('guild missing'))
      }
    }

    await postWorkerLog(client as never, basePayload)

    expect(client.guilds.fetch).toHaveBeenCalledWith('guild-1')
  })

  it.each([
    ['success', Colors.Green],
    ['warning', Colors.Yellow],
    ['error', Colors.Red]
  ] as const)(
    'sends %s level embed with matching color',
    async (level, color) => {
      vi.mocked(getGuildConfigByGuildId).mockResolvedValue({
        workerLogChannelId: 'worker-log-ch'
      } as never)

      const send = vi.fn().mockResolvedValue(undefined)
      const client = {
        guilds: {
          fetch: vi.fn().mockResolvedValue({
            id: 'guild-1',
            channels: {
              fetch: vi.fn().mockResolvedValue({
                send,
                guild: { id: 'guild-1' }
              })
            }
          })
        }
      }

      await postWorkerLog(client as never, { ...basePayload, level })

      expect(send).toHaveBeenCalledTimes(1)
      expect(send.mock.calls[0][0].embeds).toHaveLength(1)
      expect(send.mock.calls[0][0].embeds[0].data.color).toBe(color)
      expect(send.mock.calls[0][0].embeds[0].data.timestamp).toBeDefined()
    }
  )

  it('logs when send fails', async () => {
    vi.mocked(getGuildConfigByGuildId).mockResolvedValue({
      workerLogChannelId: 'worker-log-ch'
    } as never)

    const sendError = new Error('send failed')
    const send = vi.fn().mockRejectedValue(sendError)
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          id: 'guild-1',
          channels: {
            fetch: vi.fn().mockResolvedValue({
              send,
              guild: { id: 'guild-1' }
            })
          }
        })
      }
    }

    await postWorkerLog(client as never, basePayload)

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        {
          err: sendError,
          guildId: 'guild-1',
          channelId: 'worker-log-ch',
          worker: 'VIP expiration'
        },
        'Failed to send worker log'
      )
    })
  })
})
