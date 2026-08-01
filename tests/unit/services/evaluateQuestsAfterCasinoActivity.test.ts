import { beforeEach, describe, expect, it, vi } from 'vitest'

const getGuildConfigByGuildId = vi.fn()
const tryEvaluateQuests = vi.fn()
const getQuestNotifyInteraction = vi.fn()

vi.mock('@/services/guild/guildConfiguration.db', () => ({
  getGuildConfigByGuildId: (...args: unknown[]) =>
    getGuildConfigByGuildId(...args)
}))

vi.mock('@/services/quests', () => ({
  tryEvaluateQuests: (...args: unknown[]) => tryEvaluateQuests(...args),
  getQuestNotifyInteraction: (...args: unknown[]) =>
    getQuestNotifyInteraction(...args)
}))

vi.mock('gambling-bot-shared/casino', () => ({
  createCasinoBetService: () => ({
    settleCasinoWinnings: vi.fn(),
    refundLockedBet: vi.fn(),
    refundRafflePurchase: vi.fn(),
    payRaffleWinner: vi.fn()
  })
}))

vi.mock('@/models/Transaction', () => ({ default: {} }))
vi.mock('@/models/User', () => ({ default: {} }))

const { evaluateQuestsAfterCasinoActivity } =
  await import('@/services/casino/casinoBet.service')

describe('evaluateQuestsAfterCasinoActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getQuestNotifyInteraction.mockReturnValue(null)
  })

  it('evaluates with loaded guild config', async () => {
    const guildConfig = { guildId: 'g1' }
    getGuildConfigByGuildId.mockResolvedValue(guildConfig)

    evaluateQuestsAfterCasinoActivity({ guildId: 'g1', userId: 'u1' })

    await vi.waitFor(() =>
      expect(tryEvaluateQuests).toHaveBeenCalledWith({
        guildId: 'g1',
        userId: 'u1',
        guildConfig,
        interaction: null
      })
    )
  })

  it('passes notify interaction from context', async () => {
    const guildConfig = { guildId: 'g1' }
    const interaction = { followUp: vi.fn(), deferred: true }
    getGuildConfigByGuildId.mockResolvedValue(guildConfig)
    getQuestNotifyInteraction.mockReturnValue(interaction)

    evaluateQuestsAfterCasinoActivity({ guildId: 'g1', userId: 'u1' })

    await vi.waitFor(() =>
      expect(tryEvaluateQuests).toHaveBeenCalledWith({
        guildId: 'g1',
        userId: 'u1',
        guildConfig,
        interaction
      })
    )
  })

  it('evaluates with null config when load fails', async () => {
    getGuildConfigByGuildId.mockRejectedValue(new Error('missing'))

    evaluateQuestsAfterCasinoActivity({ guildId: 'g1', userId: 'u1' })

    await vi.waitFor(() =>
      expect(tryEvaluateQuests).toHaveBeenCalledWith({
        guildId: 'g1',
        userId: 'u1',
        guildConfig: null,
        interaction: null
      })
    )
  })
})
