import { beforeEach, describe, expect, it, vi } from 'vitest'

const questFind = vi.fn()
const progressFind = vi.fn()

vi.mock('@/models/Quest', () => ({
  default: { find: (...args: unknown[]) => questFind(...args) }
}))

vi.mock('@/models/UserQuestProgress', () => ({
  default: { find: (...args: unknown[]) => progressFind(...args) }
}))

const { getEnabledQuestsForGuild, getUserQuestProgressForDay } =
  await import('@/services/db/quest.db')

describe('quest.db', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads enabled quests sorted', async () => {
    const lean = vi.fn().mockResolvedValue([{ questId: 'q1' }])
    const sort = vi.fn().mockReturnValue({ lean })
    questFind.mockReturnValue({ sort })

    const result = await getEnabledQuestsForGuild('g1')
    expect(questFind).toHaveBeenCalledWith({ guildId: 'g1', enabled: true })
    expect(sort).toHaveBeenCalledWith({ sortOrder: 1, createdAt: 1 })
    expect(result).toEqual([{ questId: 'q1' }])
  })

  it('loads progress for today and lifetime', async () => {
    const lean = vi.fn().mockResolvedValue([{ questId: 'q1', dateKey: null }])
    progressFind.mockReturnValue({ lean })

    const result = await getUserQuestProgressForDay({
      guildId: 'g1',
      userId: 'u1',
      dateKey: '2026-06-15'
    })

    expect(progressFind).toHaveBeenCalledWith({
      guildId: 'g1',
      userId: 'u1',
      $or: [{ dateKey: '2026-06-15' }, { dateKey: null }]
    })
    expect(result).toEqual([{ questId: 'q1', dateKey: null }])
  })
})
