import { beforeEach, describe, expect, it, vi } from 'vitest'

import { assertModMaintenanceAllowed } from '@/services/guild/assertModMaintenance.service'
import {
  createGuildConfiguration,
  getGuildConfigByGuildId
} from '@/services/guild/guildConfiguration.db'
import {
  handleChannelSetup,
  resolveGuildConfigurationForSetup
} from '@/services/guild/setupChannelSetting.service'

vi.mock('@/services/guild/guildConfiguration.db', () => ({
  getGuildConfigByGuildId: vi.fn(),
  createGuildConfiguration: vi.fn()
}))

vi.mock('@/services/guild/assertModMaintenance.service', () => ({
  assertModMaintenanceAllowed: vi.fn()
}))

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string, description: string) => ({
    title,
    description
  }),
  createSuccessEmbed: (title: string, description: string) => ({
    title,
    description
  })
}))

const mockGetGuildConfigByGuildId = vi.mocked(getGuildConfigByGuildId)
const mockCreateGuildConfiguration = vi.mocked(createGuildConfiguration)
const mockAssertModMaintenanceAllowed = vi.mocked(assertModMaintenanceAllowed)

const messages = {
  titleAdd: 'Setup - Add',
  titleRemove: 'Setup - Remove',
  alreadySet: (channel: { toString(): string }) => `already ${channel}`,
  addSuccess: (channel: { toString(): string }) => `added ${channel}`,
  notSet: (channelId: string) => `missing ${channelId}`,
  removeSuccess: (channelId: string) => `removed ${channelId}`
}

type TestConfig = {
  scalarId: string
  listIds: string[]
  save: ReturnType<typeof vi.fn>
}

const createConfig = (overrides: Partial<TestConfig> = {}): TestConfig => ({
  scalarId: '',
  listIds: [],
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides
})

const asConfig = (c: unknown) => c as TestConfig

const scalarMode = {
  kind: 'scalar' as const,
  get: (c: unknown) => asConfig(c).scalarId,
  set: (c: unknown, id: string) => {
    asConfig(c).scalarId = id
  },
  clear: (c: unknown) => {
    asConfig(c).scalarId = ''
  }
}

const listMode = {
  kind: 'list' as const,
  get: (c: unknown) => asConfig(c).listIds,
  set: (c: unknown, ids: string[]) => {
    asConfig(c).listIds = ids
  }
}

const createInteraction = ({
  channelId = 'ch-1',
  channelIdOption = 'ch-1'
}: {
  channelId?: string
  channelIdOption?: string
} = {}) => ({
  guildId: 'guild-1',
  options: {
    getChannel: vi.fn().mockReturnValue({
      id: channelId,
      toString: () => `<#${channelId}>`
    }),
    getString: vi.fn().mockReturnValue(channelIdOption)
  },
  reply: vi.fn().mockResolvedValue(undefined)
})

describe('resolveGuildConfigurationForSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates config when missing, returns null when maintenance blocks, otherwise returns existing', async () => {
    const created = createConfig()
    mockGetGuildConfigByGuildId.mockResolvedValueOnce(null)
    mockCreateGuildConfiguration.mockResolvedValue(created as never)
    expect(
      await resolveGuildConfigurationForSetup(createInteraction() as never)
    ).toBe(created)

    const existing = createConfig()
    mockGetGuildConfigByGuildId.mockResolvedValue(existing as never)
    mockAssertModMaintenanceAllowed.mockResolvedValueOnce(false)
    expect(
      await resolveGuildConfigurationForSetup(createInteraction() as never)
    ).toBeNull()

    mockAssertModMaintenanceAllowed.mockResolvedValueOnce(existing as never)
    expect(
      await resolveGuildConfigurationForSetup(createInteraction() as never)
    ).toBe(existing)
  })
})

describe('handleChannelSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects add when already set and remove when not set (scalar)', async () => {
    const already = createConfig({ scalarId: 'ch-1' })
    const addInteraction = createInteraction()
    await handleChannelSetup({
      interaction: addInteraction as never,
      guildConfiguration: already as never,
      op: 'add',
      mode: scalarMode,
      messages
    })
    expect(already.save).not.toHaveBeenCalled()
    expect(addInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [{ title: 'Setup - Add', description: 'already <#ch-1>' }]
      })
    )

    const missing = createConfig({ scalarId: 'other' })
    const removeInteraction = createInteraction()
    await handleChannelSetup({
      interaction: removeInteraction as never,
      guildConfiguration: missing as never,
      op: 'remove',
      mode: scalarMode,
      messages
    })
    expect(removeInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [{ title: 'Setup - Remove', description: 'missing ch-1' }]
      })
    )
  })

  it('adds and removes a scalar channel', async () => {
    const config = createConfig()
    await handleChannelSetup({
      interaction: createInteraction() as never,
      guildConfiguration: config as never,
      op: 'add',
      mode: scalarMode,
      messages
    })
    expect(config.scalarId).toBe('ch-1')
    expect(config.save).toHaveBeenCalled()

    await handleChannelSetup({
      interaction: createInteraction() as never,
      guildConfiguration: config as never,
      op: 'remove',
      mode: scalarMode,
      messages
    })
    expect(config.scalarId).toBe('')
  })

  it('adds and removes list channels, and rejects invalid list ops', async () => {
    const config = createConfig()
    await handleChannelSetup({
      interaction: createInteraction({ channelId: 'ch-2' }) as never,
      guildConfiguration: config as never,
      op: 'add',
      mode: listMode,
      messages
    })
    expect(config.listIds).toEqual(['ch-2'])

    const already = createConfig({ listIds: ['ch-1'] })
    await handleChannelSetup({
      interaction: createInteraction() as never,
      guildConfiguration: already as never,
      op: 'add',
      mode: listMode,
      messages
    })
    expect(already.save).not.toHaveBeenCalled()

    await handleChannelSetup({
      interaction: createInteraction({ channelIdOption: 'ch-2' }) as never,
      guildConfiguration: config as never,
      op: 'remove',
      mode: listMode,
      messages
    })
    expect(config.listIds).toEqual([])

    const missing = createConfig({ listIds: ['other'] })
    const removeInteraction = createInteraction()
    await handleChannelSetup({
      interaction: removeInteraction as never,
      guildConfiguration: missing as never,
      op: 'remove',
      mode: listMode,
      messages
    })
    expect(removeInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [{ title: 'Setup - Remove', description: 'missing ch-1' }]
      })
    )
  })
})
