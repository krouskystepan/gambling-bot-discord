import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getUser } from '@/services/db/user.db'
import {
  checkTargetUserRegistration,
  checkUserRegistration
} from '@/services/user/checkUserRegistration.service'

import { createMockInteraction } from '../../helpers/discord-mock'

vi.mock('@/services/db/user.db', () => ({
  getUser: vi.fn()
}))

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string, description: string) => ({ title, description })
}))

const mockGetUser = vi.mocked(getUser)

describe('checkUserRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user when registered', async () => {
    const user = { userId: 'user-1', guildId: 'guild-1', balance: 100 }
    mockGetUser.mockResolvedValue(user as never)

    const interaction = {
      user: { id: 'user-1' },
      guildId: 'guild-1',
      reply: vi.fn()
    }

    const result = await checkUserRegistration({ interaction: interaction as never })
    expect(result).toEqual(user)
    expect(interaction.reply).not.toHaveBeenCalled()
  })

  it('replies and returns false when not registered', async () => {
    mockGetUser.mockResolvedValue(null)

    const interaction = createMockInteraction()
    const result = await checkUserRegistration({
      interaction: {
        user: { id: 'user-1' },
        guildId: 'guild-1',
        reply: interaction.reply
      } as never
    })

    expect(result).toBe(false)
    expect(interaction.reply).toHaveBeenCalledOnce()
    expect(interaction.getLastReply()?.embeds?.[0]?.title).toContain('Not registered')
  })
})

describe('checkTargetUserRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns target user when registered', async () => {
    const user = { userId: 'target-1', guildId: 'guild-1', balance: 50 }
    mockGetUser.mockResolvedValue(user as never)

    const interaction = { guildId: 'guild-1', reply: vi.fn() }
    const result = await checkTargetUserRegistration({
      interaction: interaction as never,
      targetUserId: 'target-1'
    })

    expect(result).toEqual(user)
  })

  it('replies when target is not registered', async () => {
    mockGetUser.mockResolvedValue(null)

    const interaction = createMockInteraction()
    const result = await checkTargetUserRegistration({
      interaction: {
        guildId: 'guild-1',
        reply: interaction.reply
      } as never,
      targetUserId: 'missing'
    })

    expect(result).toBe(false)
    expect(interaction.getLastReply()?.embeds?.[0]?.description).toContain('target user')
  })
})
