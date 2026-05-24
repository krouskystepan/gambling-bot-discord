import { describe, expect, it } from 'vitest'

import { defaultCasinoSettings } from 'gambling-bot-shared'

import {
  createGuildConfiguration,
  getGuildConfigByGuildId
} from '@/services/db/guildConfiguration.db'

import { GuildConfiguration, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

describe('guildConfiguration.db', () => {
  it('returns null when guild config is missing', async () => {
    const config = await getGuildConfigByGuildId({ guildId: 'missing-guild' })
    expect(config).toBeNull()
  })

  it('creates guild configuration with default casino settings', async () => {
    const created = await createGuildConfiguration({ guildId: 'guild-1' })

    expect(created.guildId).toBe('guild-1')
    expect(created.casinoSettings).toEqual(defaultCasinoSettings)

    const fetched = await getGuildConfigByGuildId({ guildId: 'guild-1' })
    expect(fetched?.guildId).toBe('guild-1')
    expect(await GuildConfiguration.countDocuments({ guildId: 'guild-1' })).toBe(
      1
    )
  })
})
