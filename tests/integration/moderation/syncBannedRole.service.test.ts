import { describe, expect, it, vi } from 'vitest'

import {
  type MemberForBannedRoleSync,
  syncBannedRoleForMember
} from '@/services/moderation/syncBannedRole.service'

import { User, createTestUser, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const BANNED_ROLE_ID = 'role-banned-1'

const createMockMember = ({
  userId = 'user-1',
  guildId = 'guild-1',
  hasRole = false
}: {
  userId?: string
  guildId?: string
  hasRole?: boolean
} = {}) => {
  const roles = {
    cache: {
      has: vi.fn((roleId: string) => roleId === BANNED_ROLE_ID && hasRole)
    },
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined)
  }

  return {
    id: userId,
    guild: { id: guildId },
    roles
  } as MemberForBannedRoleSync & {
    roles: {
      cache: { has: ReturnType<typeof vi.fn> }
      add: ReturnType<typeof vi.fn>
      remove: ReturnType<typeof vi.fn>
    }
  }
}

describe('syncBannedRoleForMember', () => {
  it.each([
    {
      shouldBeBanned: true,
      hasRole: false,
      expected: 'added',
      addCalled: true,
      removeCalled: false
    },
    {
      shouldBeBanned: true,
      hasRole: true,
      expected: 'skipped',
      addCalled: false,
      removeCalled: false
    },
    {
      shouldBeBanned: false,
      hasRole: true,
      expected: 'removed',
      addCalled: false,
      removeCalled: true
    },
    {
      shouldBeBanned: false,
      hasRole: false,
      expected: 'skipped',
      addCalled: false,
      removeCalled: false
    }
  ] as const)(
    'shouldBeBanned=$shouldBeBanned hasRole=$hasRole => $expected',
    async ({ shouldBeBanned, hasRole, expected, addCalled, removeCalled }) => {
      const member = createMockMember({ hasRole })

      const result = await syncBannedRoleForMember({
        member,
        bannedRoleId: BANNED_ROLE_ID,
        shouldBeBanned
      })

      expect(result).toBe(expected)

      if (addCalled) {
        expect(member.roles.add).toHaveBeenCalledWith(
          BANNED_ROLE_ID,
          'Ban role sync'
        )
      } else {
        expect(member.roles.add).not.toHaveBeenCalled()
      }

      if (removeCalled) {
        expect(member.roles.remove).toHaveBeenCalledWith(
          BANNED_ROLE_ID,
          'Ban role sync'
        )
      } else {
        expect(member.roles.remove).not.toHaveBeenCalled()
      }
    }
  )

  it('no-ops when bannedRoleId is empty', async () => {
    const member = createMockMember({ hasRole: false })

    const result = await syncBannedRoleForMember({
      member,
      bannedRoleId: '',
      shouldBeBanned: true
    })

    expect(result).toBe('skipped')
    expect(member.roles.add).not.toHaveBeenCalled()
    expect(member.roles.remove).not.toHaveBeenCalled()
  })

  it('returns error when role mutation fails', async () => {
    const member = createMockMember({ hasRole: false })
    member.roles.add.mockRejectedValue(new Error('Missing Permissions'))

    const result = await syncBannedRoleForMember({
      member,
      bannedRoleId: BANNED_ROLE_ID,
      shouldBeBanned: true
    })

    expect(result).toBe('error')
  })
})

describe('ban role sync DB queries', () => {
  it('finds banned user ids for add pass', async () => {
    await createTestUser({
      userId: 'banned-1',
      guildId: 'guild-1',
      banned: true
    })
    await createTestUser({
      userId: 'active-1',
      guildId: 'guild-1',
      banned: false
    })
    await createTestUser({
      userId: 'banned-2',
      guildId: 'guild-2',
      banned: true
    })

    const bannedInGuild = await User.find({ guildId: 'guild-1', banned: true })
      .select('userId')
      .lean()

    expect(bannedInGuild.map((u) => u.userId).sort()).toEqual(['banned-1'])
  })

  it('treats missing user as not banned for remove pass', async () => {
    await createTestUser({
      userId: 'unbanned-1',
      guildId: 'guild-1',
      banned: false
    })

    const registered = await User.findOne({
      guildId: 'guild-1',
      userId: 'unbanned-1'
    })
      .select('banned')
      .lean()

    const missing = await User.findOne({
      guildId: 'guild-1',
      userId: 'non-registered'
    })
      .select('banned')
      .lean()

    expect(Boolean(registered?.banned)).toBe(false)
    expect(Boolean(missing?.banned)).toBe(false)
  })
})
