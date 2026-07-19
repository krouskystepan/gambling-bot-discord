import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  checkAtmChannels,
  checkCasinoChannels,
  checkPredictionChannels,
  checkRaffleChannels
} from '@/services/guild/checkChannel.service'
import { getGuildConfigByGuildId } from '@/services/guild/guildConfiguration.db'
import { getActiveVipChannels } from '@/services/vip/getActiveVipChannels.service'

import { createMockInteraction } from '../../helpers/discord-mock'

vi.mock('@/services/guild/guildConfiguration.db', () => ({
  getGuildConfigByGuildId: vi.fn()
}))

vi.mock('@/services/vip/getActiveVipChannels.service', () => ({
  getActiveVipChannels: vi.fn()
}))

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string) => ({ title })
}))

const mockGetConfig = vi.mocked(getGuildConfigByGuildId)
const mockGetVipChannels = vi.mocked(getActiveVipChannels)

const interaction = (channelId = 'actions-ch') => {
  const mock = createMockInteraction()
  return {
    guildId: 'guild-1',
    channelId,
    reply: mock.reply,
    getLastReply: mock.getLastReply
  }
}

describe('checkAtmChannels', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when guild config is missing', async () => {
    mockGetConfig.mockResolvedValue(null)
    const ix = interaction()

    expect(await checkAtmChannels(ix as never)).toBe(false)
    expect(ix.reply).toHaveBeenCalledOnce()
  })

  it('returns false when ATM channels are incomplete', async () => {
    mockGetConfig.mockResolvedValue({
      atmChannelIds: { logs: 'log-ch' }
    } as never)
    const ix = interaction()

    expect(await checkAtmChannels(ix as never)).toBe(false)
  })

  it('returns false in wrong channel', async () => {
    mockGetConfig.mockResolvedValue({
      atmChannelIds: { logs: 'log-ch', actions: 'atm-actions' }
    } as never)
    const ix = interaction('wrong-ch')

    expect(await checkAtmChannels(ix as never)).toBe(false)
  })

  it('returns config in ATM actions channel', async () => {
    const config = {
      atmChannelIds: { logs: 'log-ch', actions: 'atm-actions' }
    }
    mockGetConfig.mockResolvedValue(config as never)
    const ix = interaction('atm-actions')

    expect(await checkAtmChannels(ix as never)).toEqual(config)
  })

  it('returns false during maintenance mode', async () => {
    mockGetConfig.mockResolvedValue({
      atmChannelIds: { logs: 'log-ch', actions: 'atm-actions' },
      globalSettings: { ...defaultGlobalSettings, maintenanceMode: true }
    } as never)
    const ix = interaction('atm-actions')

    expect(await checkAtmChannels(ix as never)).toBe(false)
  })
})

describe('checkCasinoChannels', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when guild config is missing', async () => {
    mockGetConfig.mockResolvedValue(null)
    const ix = interaction()

    expect(await checkCasinoChannels(ix as never)).toBe(false)
    expect(ix.reply).toHaveBeenCalledOnce()
  })

  it('returns false when no casino or VIP channels exist', async () => {
    mockGetConfig.mockResolvedValue({ casinoChannelIds: [] } as never)
    mockGetVipChannels.mockResolvedValue([])
    const ix = interaction()

    expect(await checkCasinoChannels(ix as never)).toBe(false)
  })

  it('allows VIP channel even if not in casino list', async () => {
    const config = { casinoChannelIds: ['casino-ch'] }
    mockGetConfig.mockResolvedValue(config as never)
    mockGetVipChannels.mockResolvedValue(['vip-ch'])
    const ix = interaction('vip-ch')

    expect(await checkCasinoChannels(ix as never)).toEqual(config)
  })

  it('treats missing casinoChannelIds as empty and uses VIP channels', async () => {
    const config = { guildId: 'guild-1' }
    mockGetConfig.mockResolvedValue(config as never)
    mockGetVipChannels.mockResolvedValue(['vip-only'])
    const ix = interaction('vip-only')

    expect(await checkCasinoChannels(ix as never)).toEqual(config)
  })

  it('returns false in disallowed channel', async () => {
    mockGetConfig.mockResolvedValue({
      casinoChannelIds: ['casino-ch']
    } as never)
    mockGetVipChannels.mockResolvedValue([])
    const ix = interaction('other-ch')

    expect(await checkCasinoChannels(ix as never)).toBe(false)
  })

  it('returns false during maintenance mode', async () => {
    mockGetConfig.mockResolvedValue({
      casinoChannelIds: ['casino-ch'],
      globalSettings: { ...defaultGlobalSettings, maintenanceMode: true }
    } as never)
    mockGetVipChannels.mockResolvedValue([])
    const ix = interaction('casino-ch')

    expect(await checkCasinoChannels(ix as never)).toBe(false)
  })

  it('returns false when casino games are disabled globally', async () => {
    mockGetConfig.mockResolvedValue({
      casinoChannelIds: ['casino-ch'],
      globalSettings: { ...defaultGlobalSettings, disableCasinoGames: true }
    } as never)
    mockGetVipChannels.mockResolvedValue([])
    const ix = interaction('casino-ch')

    expect(await checkCasinoChannels(ix as never)).toBe(false)
    expect(ix.reply).toHaveBeenCalled()
  })
})

describe('checkPredictionChannels', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when prediction channels missing', async () => {
    mockGetConfig.mockResolvedValue({} as never)
    expect(await checkPredictionChannels(interaction() as never)).toBe(false)
  })

  it('returns false in wrong prediction channel', async () => {
    mockGetConfig.mockResolvedValue({
      predictionChannelIds: { logs: 'pred-log', actions: 'pred-actions' }
    } as never)
    const ix = interaction('wrong-ch')

    expect(await checkPredictionChannels(ix as never)).toBe(false)
  })

  it('returns config in prediction actions channel', async () => {
    const config = {
      predictionChannelIds: { logs: 'pred-log', actions: 'pred-actions' }
    }
    mockGetConfig.mockResolvedValue(config as never)
    const ix = interaction('pred-actions')

    expect(await checkPredictionChannels(ix as never)).toEqual(config)
  })

  it('returns false during maintenance mode', async () => {
    mockGetConfig.mockResolvedValue({
      predictionChannelIds: { logs: 'pred-log', actions: 'pred-actions' },
      globalSettings: { ...defaultGlobalSettings, maintenanceMode: true }
    } as never)
    const ix = interaction('pred-actions')

    expect(await checkPredictionChannels(ix as never)).toBe(false)
  })
})

describe('checkRaffleChannels', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when raffle channels are missing', async () => {
    mockGetConfig.mockResolvedValue({} as never)
    expect(await checkRaffleChannels(interaction() as never)).toBe(false)
  })

  it('returns false in wrong raffle channel', async () => {
    mockGetConfig.mockResolvedValue({
      raffleChannelIds: { logs: 'raffle-log', actions: 'raffle-actions' }
    } as never)
    expect(await checkRaffleChannels(interaction('wrong-ch') as never)).toBe(
      false
    )
  })

  it('returns config in raffle actions channel', async () => {
    const config = {
      raffleChannelIds: { logs: 'raffle-log', actions: 'raffle-actions' }
    }
    mockGetConfig.mockResolvedValue(config as never)
    const ix = interaction('raffle-actions')

    expect(await checkRaffleChannels(ix as never)).toEqual(config)
  })

  it('returns false during maintenance mode', async () => {
    mockGetConfig.mockResolvedValue({
      raffleChannelIds: { logs: 'raffle-log', actions: 'raffle-actions' },
      globalSettings: { ...defaultGlobalSettings, maintenanceMode: true }
    } as never)
    const ix = interaction('raffle-actions')

    expect(await checkRaffleChannels(ix as never)).toBe(false)
  })
})
