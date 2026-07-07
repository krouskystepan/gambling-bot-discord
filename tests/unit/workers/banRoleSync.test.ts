import { beforeEach, describe, expect, it, vi } from 'vitest'

import { banRoleSyncJob } from '@/workers/jobs/banRoleSync.job'

vi.mock('@/models/GuildConfiguration', () => ({
  default: {
    findOne: vi.fn()
  }
}))

vi.mock('@/services/moderation', () => ({
  syncGuildBannedRoles: vi.fn()
}))

vi.mock('@/services/worker/workerDiscordLog.service', () => ({
  postWorkerLog: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: { worker: vi.fn(), error: vi.fn() }
}))

const GuildConfiguration = (await import('@/models/GuildConfiguration')).default
const { syncGuildBannedRoles } = await import('@/services/moderation')
const { postWorkerLog } = await import(
  '@/services/worker/workerDiscordLog.service'
)
const { logger } = await import('@/utils/logger')

describe('banRoleSyncJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts per-guild worker log when roles change', async () => {
    const guild = { id: 'guild-1', name: 'Test Guild' }

    vi.mocked(GuildConfiguration.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ bannedRoleId: 'ban-role' })
      })
    } as never)

    vi.mocked(syncGuildBannedRoles).mockResolvedValue({
      added: 2,
      removed: 1,
      skipped: 0,
      errors: 0
    })

    const client = {
      guilds: {
        cache: {
          values: vi.fn().mockReturnValue([guild][Symbol.iterator]())
        }
      }
    }

    await banRoleSyncJob(client as never)

    expect(logger.worker).toHaveBeenCalledWith(
      'Ban role sync: +2 -1 in Test Guild (guild-1)'
    )
    expect(postWorkerLog).toHaveBeenCalledWith(client, {
      guildId: 'guild-1',
      worker: 'Ban sync',
      title: 'Ban roles updated',
      description: '**2** players got the ban role. **1** had it removed.'
    })
  })

  it('skips worker log when no roles changed', async () => {
    const guild = { id: 'guild-1', name: 'Test Guild' }

    vi.mocked(GuildConfiguration.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ bannedRoleId: 'ban-role' })
      })
    } as never)

    vi.mocked(syncGuildBannedRoles).mockResolvedValue({
      added: 0,
      removed: 0,
      skipped: 0,
      errors: 0
    })

    const client = {
      guilds: {
        cache: {
          values: vi.fn().mockReturnValue([guild][Symbol.iterator]())
        }
      }
    }

    await banRoleSyncJob(client as never)

    expect(logger.worker).not.toHaveBeenCalled()
    expect(postWorkerLog).not.toHaveBeenCalled()
  })
})
