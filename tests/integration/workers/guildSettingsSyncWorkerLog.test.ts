import { normalizeCasinoSettings } from 'gambling-bot-shared/casino'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createGuildConfiguration } from '@/services/db/guildConfiguration.db'
import { guildSettingsSyncJob } from '@/workers/jobs/guildSettingsSync.job'

import { GuildConfiguration, setupMongoTests } from '../../helpers/mongo'

vi.mock('@/services/worker/workerDiscordLog.service', () => ({
  postWorkerLog: vi.fn()
}))

const { postWorkerLog } = await import(
  '@/services/worker/workerDiscordLog.service'
)

setupMongoTests()

describe('guildSettingsSyncJob integration worker logs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts worker log when settings are updated', async () => {
    await createGuildConfiguration({ guildId: 'guild-worker-log' })
    await GuildConfiguration.collection.updateOne(
      { guildId: 'guild-worker-log' },
      {
        $set: {
          casinoSettings: { dice: { minBet: 5 } } as Record<string, unknown>
        }
      }
    )

    const guild = { id: 'guild-worker-log', name: 'Worker Log Guild' }
    const client = {
      guilds: {
        cache: {
          values: vi.fn().mockReturnValue([guild][Symbol.iterator]())
        }
      }
    }

    await guildSettingsSyncJob(client as never)

    const updated = await GuildConfiguration.findOne({
      guildId: 'guild-worker-log'
    }).lean()
    expect(updated?.casinoSettings).toEqual(
      normalizeCasinoSettings(
        { dice: { minBet: 5 } } as Parameters<typeof normalizeCasinoSettings>[0]
      )
    )

    expect(postWorkerLog).toHaveBeenCalledWith(client, {
      guildId: 'guild-worker-log',
      worker: 'Settings sync',
      title: 'Settings updated',
      description: 'Updated **casinoSettings** for **Worker Log Guild**.'
    })
  })
})
