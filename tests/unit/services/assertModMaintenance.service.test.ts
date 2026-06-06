import { defaultGlobalSettings } from 'gambling-bot-shared'
import { PermissionFlagsBits } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getGuildConfigByGuildId } from '@/services/db/guildConfiguration.db'
import { assertModMaintenanceAllowed } from '@/services/guildConfiguration/assertModMaintenance.service'

import { createMockInteraction } from '../../helpers/discord-mock'

vi.mock('@/services/db/guildConfiguration.db', () => ({
  getGuildConfigByGuildId: vi.fn()
}))

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string) => ({ title })
}))

const mockGetConfig = vi.mocked(getGuildConfigByGuildId)

const repliable = (admin = false) => {
  const mock = createMockInteraction()
  return {
    user: { id: 'user-1' },
    guild: {
      members: {
        fetch: vi.fn().mockResolvedValue({
          permissions: {
            has: (permission: bigint) =>
              admin && permission === PermissionFlagsBits.Administrator
          }
        })
      }
    },
    replied: false,
    deferred: false,
    reply: mock.reply,
    editReply: vi.fn()
  }
}

describe('assertModMaintenanceAllowed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when guild config is missing', async () => {
    mockGetConfig.mockResolvedValue(null)
    expect(
      await assertModMaintenanceAllowed(repliable() as never, 'guild-1')
    ).toBeNull()
  })

  it('returns false and replies when maintenance blocks non-admins', async () => {
    mockGetConfig.mockResolvedValue({
      globalSettings: { ...defaultGlobalSettings, maintenanceMode: true }
    } as never)
    const ix = repliable(false)

    expect(await assertModMaintenanceAllowed(ix as never, 'guild-1')).toBe(false)
    expect(ix.reply).toHaveBeenCalledOnce()
  })

  it('returns config when maintenance is off', async () => {
    const config = { guildId: 'guild-1', globalSettings: defaultGlobalSettings }
    mockGetConfig.mockResolvedValue(config as never)

    expect(await assertModMaintenanceAllowed(repliable() as never, 'guild-1')).toEqual(
      config
    )
  })

  it('returns config for admins during maintenance', async () => {
    const config = {
      guildId: 'guild-1',
      globalSettings: { ...defaultGlobalSettings, maintenanceMode: true }
    }
    mockGetConfig.mockResolvedValue(config as never)

    expect(
      await assertModMaintenanceAllowed(repliable(true) as never, 'guild-1')
    ).toEqual(config)
  })
})
