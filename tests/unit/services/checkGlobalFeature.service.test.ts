import { defaultGlobalSettings, type GlobalFeature } from 'gambling-bot-shared'
import type { TGuildConfiguration } from 'gambling-bot-shared'
import { PermissionFlagsBits } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  assertGlobalFeature,
  assertNotMaintenance,
  canBypassMaintenance
} from '@/services/guildConfiguration/checkGlobalFeature.service'

import { createMockInteraction } from '../../helpers/discord-mock'

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string, description: string) => ({ title, description })
}))

const baseConfig = (
  globalSettings?: Partial<typeof defaultGlobalSettings>
): TGuildConfiguration =>
  ({
    guildId: 'g1',
    globalSettings: { ...defaultGlobalSettings, ...globalSettings }
  }) as TGuildConfiguration

const repliable = (opts?: {
  admin?: boolean
  fetchFails?: boolean
  noGuild?: boolean
  replied?: boolean
  deferred?: boolean
}) => {
  const mock = createMockInteraction()
  const fetch = vi.fn().mockImplementation(async () => {
    if (opts?.fetchFails) throw new Error('fetch failed')
    if (opts?.noGuild) return null
    return {
      permissions: {
        has: (permission: bigint) =>
          opts?.admin === true && permission === PermissionFlagsBits.Administrator
      }
    }
  })

  return {
    user: { id: 'user-1' },
    guild: opts?.noGuild
      ? null
      : { members: { fetch } },
    replied: opts?.replied ?? false,
    deferred: opts?.deferred ?? false,
    reply: mock.reply,
    editReply: vi.fn().mockResolvedValue(undefined),
    getLastReply: mock.getLastReply
  }
}

describe('canBypassMaintenance', () => {
  it('returns false when guild is missing', async () => {
    expect(await canBypassMaintenance(repliable({ noGuild: true }) as never)).toBe(
      false
    )
  })

  it('returns false when member fetch fails', async () => {
    expect(await canBypassMaintenance(repliable({ fetchFails: true }) as never)).toBe(
      false
    )
  })

  it('returns false for non-admin members', async () => {
    expect(await canBypassMaintenance(repliable({ admin: false }) as never)).toBe(
      false
    )
  })

  it('returns true for server administrators', async () => {
    expect(await canBypassMaintenance(repliable({ admin: true }) as never)).toBe(true)
  })
})

describe('assertNotMaintenance', () => {
  it('returns true when maintenance mode is off', async () => {
    const ix = repliable()
    expect(await assertNotMaintenance(ix as never, baseConfig())).toBe(true)
    expect(ix.reply).not.toHaveBeenCalled()
  })

  it('returns true when maintenance is on but user is admin', async () => {
    const ix = repliable({ admin: true })
    expect(
      await assertNotMaintenance(
        ix as never,
        baseConfig({ maintenanceMode: true })
      )
    ).toBe(true)
  })

  it('replies and returns false when maintenance blocks non-admins', async () => {
    const ix = repliable()
    expect(
      await assertNotMaintenance(
        ix as never,
        baseConfig({ maintenanceMode: true })
      )
    ).toBe(false)
    expect(ix.getLastReply()?.embeds?.[0]?.title).toBe('Error - Maintenance')
  })
})

describe('assertGlobalFeature', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when the feature is enabled', async () => {
    const ix = repliable()
    expect(await assertGlobalFeature(ix as never, baseConfig(), 'deposit')).toBe(
      true
    )
  })

  it('returns true for maintenance when user can bypass', async () => {
    const ix = repliable({ admin: true })
    expect(
      await assertGlobalFeature(
        ix as never,
        baseConfig({ maintenanceMode: true }),
        'maintenance'
      )
    ).toBe(true)
  })

  it('uses editReply when interaction already replied', async () => {
    const ix = repliable({ replied: true })
    await assertGlobalFeature(
      ix as never,
      baseConfig({ disableDeposits: true }),
      'deposit'
    )
    expect(ix.editReply).toHaveBeenCalledOnce()
    expect(ix.reply).not.toHaveBeenCalled()
  })

  it('uses editReply when interaction is deferred', async () => {
    const ix = repliable({ deferred: true })
    await assertGlobalFeature(
      ix as never,
      baseConfig({ disableWithdrawals: true }),
      'withdraw'
    )
    expect(ix.editReply).toHaveBeenCalledOnce()
  })

  it('replies and returns false when feature is disabled', async () => {
    const ix = repliable()
    expect(
      await assertGlobalFeature(
        ix as never,
        baseConfig({ disableDeposits: true }),
        'deposit'
      )
    ).toBe(false)
    expect(ix.getLastReply()?.embeds?.[0]?.title).toBe('Error - Feature Disabled')
  })
})

const featureCases: {
  feature: GlobalFeature
  settings: Partial<typeof defaultGlobalSettings>
  title: string
}[] = [
  {
    feature: 'registration',
    settings: { disableRegistrations: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'deposit',
    settings: { disableDeposits: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'withdraw',
    settings: { disableWithdrawals: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'casinoGames',
    settings: { disableCasinoGames: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'casinoGamesForMods',
    settings: { disableCasinoGamesForMods: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'predictions',
    settings: { disablePredictions: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'predictionManagement',
    settings: { disablePredictionManagement: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'raffles',
    settings: { disableRaffles: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'raffleManagement',
    settings: { disableRaffleManagement: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'dailyBonus',
    settings: { disableDailyBonus: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'vip',
    settings: { disableVip: true },
    title: 'Error - Feature Disabled'
  },
  {
    feature: 'maintenance',
    settings: { maintenanceMode: true },
    title: 'Error - Maintenance'
  }
]

describe.each(featureCases)(
  'assertGlobalFeature disabled messages ($feature)',
  ({ feature, settings, title }) => {
    it('sends the correct error embed', async () => {
      const ix = repliable()
      await assertGlobalFeature(ix as never, baseConfig(settings), feature)
      expect(ix.getLastReply()?.embeds?.[0]?.title).toBe(title)
      expect(ix.getLastReply()?.embeds?.[0]?.description).toBeTypeOf('string')
    })
  }
)
