import { beforeEach, describe, expect, it, vi } from 'vitest'

import User from '@/models/User'
import {
  type MemberForBannedRoleSync,
  syncGuildBannedRoles
} from '@/services/moderation/syncBannedRole.service'

vi.mock('@/utils/common/utils', () => ({
  sleep: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn() }
}))

const { logger } = await import('@/utils/logger')

const BANNED_ROLE_ID = 'role-banned-1'

const createMockMember = ({
  userId,
  hasRole = false,
  addFails = false,
  removeFails = false
}: {
  userId: string
  hasRole?: boolean
  addFails?: boolean
  removeFails?: boolean
}) => {
  const roles = {
    cache: {
      has: vi.fn((roleId: string) => roleId === BANNED_ROLE_ID && hasRole)
    },
    add: addFails
      ? vi.fn().mockRejectedValue(new Error('Missing Permissions'))
      : vi.fn().mockResolvedValue(undefined),
    remove: removeFails
      ? vi.fn().mockRejectedValue(new Error('Missing Permissions'))
      : vi.fn().mockResolvedValue(undefined)
  }

  return {
    id: userId,
    guild: { id: 'guild-1' },
    roles
  } as MemberForBannedRoleSync & {
    roles: {
      cache: { has: ReturnType<typeof vi.fn> }
      add: ReturnType<typeof vi.fn>
      remove: ReturnType<typeof vi.fn>
    }
  }
}

describe('syncGuildBannedRoles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns zero counts when bannedRoleId is empty', async () => {
    const guild = {
      id: 'guild-1',
      members: { fetch: vi.fn() },
      roles: { fetch: vi.fn() }
    }

    const result = await syncGuildBannedRoles({
      guild,
      bannedRoleId: ''
    })

    expect(result).toEqual({
      added: 0,
      removed: 0,
      skipped: 0,
      errors: 0
    })
    expect(guild.members.fetch).not.toHaveBeenCalled()
  })

  it('adds, removes, skips, and records errors across both passes', async () => {
    const bannedMember = createMockMember({
      userId: 'banned-1',
      hasRole: false
    })
    const alreadyBannedMember = createMockMember({
      userId: 'banned-2',
      hasRole: true
    })
    const staleRoleMember = createMockMember({
      userId: 'stale-role',
      hasRole: true
    })
    const stillBannedMember = createMockMember({
      userId: 'still-banned',
      hasRole: true
    })
    const missingMember = createMockMember({
      userId: 'missing-role',
      hasRole: true,
      removeFails: true
    })

    vi.spyOn(User, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi
          .fn()
          .mockResolvedValue([
            { userId: 'banned-1' },
            { userId: 'banned-2' },
            { userId: 'missing-member' }
          ])
      })
    } as never)

    vi.spyOn(User, 'findOne').mockImplementation((query: unknown) => {
      const q = query as { userId?: string }
      return {
        select: vi.fn().mockReturnValue({
          lean: vi
            .fn()
            .mockResolvedValue(
              q.userId === 'stale-role' || q.userId === 'missing-role'
                ? { banned: false }
                : q.userId === 'still-banned'
                  ? { banned: true }
                  : null
            )
        })
      } as never
    })

    const guild = {
      id: 'guild-1',
      members: {
        fetch: vi.fn(async (userId: string) => {
          if (userId === 'banned-1') return bannedMember
          if (userId === 'banned-2') return alreadyBannedMember
          if (userId === 'missing-member') {
            return Promise.reject(new Error('Unknown Member'))
          }
          return null
        })
      },
      roles: {
        fetch: vi.fn().mockResolvedValue({
          members: {
            values: vi
              .fn()
              .mockReturnValue(
                [staleRoleMember, stillBannedMember, missingMember][
                  Symbol.iterator
                ]()
              )
          }
        })
      }
    }

    const result = await syncGuildBannedRoles({
      guild,
      bannedRoleId: BANNED_ROLE_ID
    })

    expect(result).toEqual({
      added: 1,
      removed: 1,
      skipped: 2,
      errors: 1
    })
    expect(bannedMember.roles.add).toHaveBeenCalledWith(
      BANNED_ROLE_ID,
      'Ban role sync'
    )
    expect(staleRoleMember.roles.remove).toHaveBeenCalledWith(
      BANNED_ROLE_ID,
      'Ban role sync'
    )
  })

  it('skips remove pass when banned role is missing', async () => {
    vi.spyOn(User, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([])
      })
    } as never)

    const guild = {
      id: 'guild-1',
      members: { fetch: vi.fn() },
      roles: { fetch: vi.fn().mockRejectedValue(new Error('Unknown Role')) }
    }

    const result = await syncGuildBannedRoles({
      guild,
      bannedRoleId: BANNED_ROLE_ID
    })

    expect(result).toEqual({
      added: 0,
      removed: 0,
      skipped: 0,
      errors: 0
    })
    expect(logger.error).toHaveBeenCalledWith(
      { guildId: 'guild-1', bannedRoleId: BANNED_ROLE_ID },
      'Ban role sync skipped: banned role not found'
    )
  })
})
