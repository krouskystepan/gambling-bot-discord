import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('gambling-bot-shared/quests', () => ({
  evaluateAndGrantQuests: vi.fn()
}))

vi.mock('gambling-bot-shared/guild', () => ({
  isGlobalFeatureDisabled: vi.fn()
}))

vi.mock('gambling-bot-shared/common', () => ({
  formatMoney: vi.fn((n: number) => `$${n}`)
}))

vi.mock('@/models/Quest', () => ({ default: { name: 'Quest' } }))
vi.mock('@/models/UserQuestProgress', () => ({
  default: { name: 'UserQuestProgress' }
}))
vi.mock('@/models/User', () => ({ default: { name: 'User' } }))
vi.mock('@/models/Transaction', () => ({ default: { name: 'Transaction' } }))

vi.mock('@/utils/discord/createEmbed', () => ({
  createSuccessEmbed: vi.fn((title: string, description: string) => ({
    title,
    description
  }))
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn() }
}))

const { evaluateAndGrantQuests } = await import('gambling-bot-shared/quests')
const { isGlobalFeatureDisabled } = await import('gambling-bot-shared/guild')
const { createSuccessEmbed } = await import('@/utils/discord/createEmbed')
const { logger } = await import('@/utils/logger')
const { runQuestEvaluation, tryEvaluateQuests } = await import(
  '@/services/quests/evaluateQuests.service'
)

describe('runQuestEvaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(evaluateAndGrantQuests).mockResolvedValue({
      completed: [],
      questDailyStreak: 0
    })
    vi.mocked(isGlobalFeatureDisabled).mockReturnValue(false)
  })

  it('passes disableQuests from guild config', async () => {
    vi.mocked(isGlobalFeatureDisabled).mockReturnValue(true)
    const guildConfig = {
      globalSettings: { timezone: 'UTC', disableQuests: true }
    }

    await runQuestEvaluation({
      guildId: 'g1',
      userId: 'u1',
      guildConfig: guildConfig as never
    })

    expect(evaluateAndGrantQuests).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: 'g1',
        userId: 'u1',
        disableQuests: true,
        timezone: 'UTC'
      })
    )
  })

  it('treats missing guild config as enabled', async () => {
    await runQuestEvaluation({ guildId: 'g1', userId: 'u1' })
    expect(evaluateAndGrantQuests).toHaveBeenCalledWith(
      expect.objectContaining({ disableQuests: false })
    )
  })
})

describe('tryEvaluateQuests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isGlobalFeatureDisabled).mockReturnValue(false)
  })

  it('sends follow-up when quests complete', async () => {
    vi.mocked(evaluateAndGrantQuests).mockResolvedValue({
      completed: [
        {
          quest: { name: 'Win 3' } as never,
          rewardAmount: 100,
          kind: 'daily',
          progress: 3,
          dateKey: '2026-06-15'
        }
      ],
      questDailyStreak: 3
    })

    const followUp = vi.fn().mockResolvedValue(undefined)
    tryEvaluateQuests({
      guildId: 'g1',
      userId: 'u1',
      guildConfig: {
        globalSettings: { currencySymbol: '$', currencyPlacement: 'prefix' }
      } as never,
      interaction: { followUp, deferred: true }
    })

    await vi.waitFor(() => expect(followUp).toHaveBeenCalled())
    expect(createSuccessEmbed).toHaveBeenCalledWith(
      'Quest Complete',
      expect.stringContaining('Win 3')
    )
  })

  it('skips follow-up when interaction is not acknowledged', async () => {
    vi.mocked(evaluateAndGrantQuests).mockResolvedValue({
      completed: [
        {
          quest: { name: 'Win 3' } as never,
          rewardAmount: 100,
          kind: 'daily',
          progress: 3,
          dateKey: '2026-06-15'
        }
      ],
      questDailyStreak: 0
    })

    const followUp = vi.fn().mockResolvedValue(undefined)
    tryEvaluateQuests({
      guildId: 'g1',
      userId: 'u1',
      interaction: { followUp }
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(followUp).not.toHaveBeenCalled()
  })

  it('skips follow-up when nothing completed', async () => {
    vi.mocked(evaluateAndGrantQuests).mockResolvedValue({
      completed: [],
      questDailyStreak: 0
    })
    const followUp = vi.fn()
    tryEvaluateQuests({
      guildId: 'g1',
      userId: 'u1',
      interaction: { followUp }
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(followUp).not.toHaveBeenCalled()
  })

  it('logs when follow-up fails', async () => {
    vi.mocked(evaluateAndGrantQuests).mockResolvedValue({
      completed: [
        {
          quest: { name: 'Q' } as never,
          rewardAmount: 1,
          kind: 'normal',
          progress: 1,
          dateKey: null
        }
      ],
      questDailyStreak: 0
    })
    const followUp = vi.fn().mockRejectedValue(new Error('fail'))
    tryEvaluateQuests({
      guildId: 'g1',
      userId: 'u1',
      interaction: { followUp, replied: true }
    })
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled())
  })

  it('logs when evaluation fails', async () => {
    vi.mocked(evaluateAndGrantQuests).mockRejectedValue(new Error('db down'))
    tryEvaluateQuests({ guildId: 'g1', userId: 'u1' })
    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: 'g1', userId: 'u1' }),
        'Quest evaluation failed'
      )
    )
  })
})
