import { beforeEach, describe, expect, it, vi } from 'vitest'

import { guildSettingsSyncJob } from '@/workers/jobs/guildSettingsSync.job'

vi.mock('@/models/GuildConfiguration', () => ({
  default: {
    findOne: vi.fn()
  }
}))

vi.mock('@/services', () => ({
  createGuildConfiguration: vi.fn()
}))

vi.mock('@/services/worker/workerDiscordLog.service', () => ({
  postWorkerLog: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: { worker: vi.fn(), error: vi.fn() }
}))

const GuildConfiguration = (await import('@/models/GuildConfiguration')).default
const { createGuildConfiguration } = await import('@/services')
const { postWorkerLog } = await import(
  '@/services/worker/workerDiscordLog.service'
)

describe('guildSettingsSyncJob worker logs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts worker log when settings are created', async () => {
    const guild = { id: 'guild-1', name: 'Test Guild' }

    vi.mocked(GuildConfiguration.findOne).mockResolvedValue(null)
    vi.mocked(createGuildConfiguration).mockResolvedValue({} as never)

    const client = {
      guilds: {
        cache: {
          values: vi.fn().mockReturnValue([guild][Symbol.iterator]())
        }
      }
    }

    await guildSettingsSyncJob(client as never)

    expect(postWorkerLog).toHaveBeenCalledWith(client, {
      guildId: 'guild-1',
      worker: 'Guild settings sync',
      title: 'Settings created',
      description: 'Created default settings for **Test Guild**.',
      level: 'success'
    })
  })
})
