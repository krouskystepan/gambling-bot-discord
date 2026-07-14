import { describe, expect, it, vi } from 'vitest'

import {
  banUserDiscord,
  resolveTargetHasManagerRole,
  unbanUserDiscord
} from '@/services/moderation/userBan.service'

import {
  User,
  UserBan,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

const BANNED_ROLE_ID = 'role-banned-1'
const MANAGER_ROLE_ID = 'role-manager-1'

const createMockMember = ({
  userId = 'target-1',
  hasBannedRole = false,
  hasManagerRole = false
}: {
  userId?: string
  hasBannedRole?: boolean
  hasManagerRole?: boolean
} = {}) => {
  const roles = {
    cache: {
      has: vi.fn((roleId: string) => {
        if (roleId === BANNED_ROLE_ID) return hasBannedRole
        if (roleId === MANAGER_ROLE_ID) return hasManagerRole
        return false
      })
    },
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined)
  }

  return {
    id: userId,
    guild: { id: 'guild-1' },
    roles
  }
}

describe('resolveTargetHasManagerRole', () => {
  it('returns true when target has the manager role', () => {
    const member = createMockMember({ hasManagerRole: true })

    expect(
      resolveTargetHasManagerRole({
        managerRoleId: MANAGER_ROLE_ID,
        guildMember: member
      })
    ).toBe(true)
  })

  it('returns false when manager role is unset or member is missing', () => {
    expect(
      resolveTargetHasManagerRole({
        managerRoleId: null,
        guildMember: createMockMember({ hasManagerRole: true })
      })
    ).toBe(false)

    expect(
      resolveTargetHasManagerRole({
        managerRoleId: MANAGER_ROLE_ID,
        guildMember: null
      })
    ).toBe(false)
  })
})

describe('banUserDiscord', () => {
  it('denies self, manager targets, and duplicate bans', async () => {
    await createTestUser({ userId: 'target-1', banned: true })

    expect(
      await banUserDiscord({
        guildId: 'guild-1',
        actorUserId: 'actor-1',
        actorIsElevated: false,
        targetUserId: 'actor-1',
        targetHasManagerRole: false
      })
    ).toEqual({
      ok: false,
      code: 'SELF',
      message: 'You cannot ban or unban yourself.'
    })

    expect(
      await banUserDiscord({
        guildId: 'guild-1',
        actorUserId: 'actor-1',
        actorIsElevated: false,
        targetUserId: 'manager-1',
        targetHasManagerRole: true
      })
    ).toEqual({
      ok: false,
      code: 'MANAGER_TARGET',
      message: 'Managers cannot ban or unban other managers.'
    })

    expect(
      await banUserDiscord({
        guildId: 'guild-1',
        actorUserId: 'actor-1',
        actorIsElevated: false,
        targetUserId: 'target-1',
        targetHasManagerRole: false
      })
    ).toEqual({
      ok: false,
      code: 'ALREADY_BANNED',
      message: 'User is already banned.'
    })
  })

  it('bans a registered user and syncs the banned role', async () => {
    await createTestUser({ userId: 'target-1' })
    const member = createMockMember({ userId: 'target-1' })

    const result = await banUserDiscord({
      guildId: 'guild-1',
      actorUserId: 'actor-1',
      actorIsElevated: false,
      targetUserId: 'target-1',
      targetHasManagerRole: false,
      reason: ' abuse ',
      guildMember: member,
      bannedRoleId: BANNED_ROLE_ID
    })

    expect(result).toEqual({ ok: true, banReason: 'abuse' })

    const user = await User.findOne({ guildId: 'guild-1', userId: 'target-1' })
    const ban = await UserBan.findOne({
      guildId: 'guild-1',
      userId: 'target-1'
    })

    expect(user?.banned).toBe(true)
    expect(user?.bannedBy).toBe('actor-1')
    expect(ban?.banReason).toBe('abuse')
    expect(member.roles.add).toHaveBeenCalledWith(
      BANNED_ROLE_ID,
      'Ban role sync'
    )
  })

  it('returns not registered when target has no user record', async () => {
    expect(
      await banUserDiscord({
        guildId: 'guild-1',
        actorUserId: 'actor-1',
        actorIsElevated: true,
        targetUserId: 'missing-1',
        targetHasManagerRole: false
      })
    ).toEqual({
      ok: false,
      code: 'NOT_REGISTERED',
      message: 'User is not registered.'
    })
  })

  it('bans without syncing roles when member or role id is missing', async () => {
    await createTestUser({ userId: 'target-2' })

    const result = await banUserDiscord({
      guildId: 'guild-1',
      actorUserId: 'actor-1',
      actorIsElevated: false,
      targetUserId: 'target-2',
      targetHasManagerRole: false
    })

    expect(result).toEqual({ ok: true, banReason: undefined })
  })
})

describe('unbanUserDiscord', () => {
  it('denies invalid targets and unbans active bans', async () => {
    await createTestUser({ userId: 'target-1', banned: true })
    await UserBan.create({
      banId: 'ban-1',
      guildId: 'guild-1',
      userId: 'target-1',
      bannedAt: new Date('2026-01-01T00:00:00.000Z'),
      bannedBy: 'actor-0',
      unbannedAt: null,
      unbannedBy: null
    })

    expect(
      await unbanUserDiscord({
        guildId: 'guild-1',
        actorUserId: 'actor-1',
        actorIsElevated: false,
        targetUserId: 'manager-1',
        targetHasManagerRole: true
      })
    ).toEqual({
      ok: false,
      code: 'MANAGER_TARGET',
      message: 'Managers cannot ban or unban other managers.'
    })

    const member = createMockMember({ userId: 'target-1', hasBannedRole: true })

    const result = await unbanUserDiscord({
      guildId: 'guild-1',
      actorUserId: 'actor-1',
      actorIsElevated: true,
      targetUserId: 'target-1',
      targetHasManagerRole: false,
      reason: ' appeal ',
      guildMember: member,
      bannedRoleId: BANNED_ROLE_ID
    })

    expect(result).toEqual({ ok: true, unbanReason: 'appeal' })

    const user = await User.findOne({ guildId: 'guild-1', userId: 'target-1' })
    const ban = await UserBan.findOne({ banId: 'ban-1' })

    expect(user?.banned).toBe(false)
    expect(ban?.unbannedBy).toBe('actor-1')
    expect(ban?.unbanReason).toBe('appeal')
    expect(member.roles.remove).toHaveBeenCalledWith(
      BANNED_ROLE_ID,
      'Ban role sync'
    )
  })

  it('returns not banned when user is active', async () => {
    await createTestUser({ userId: 'target-1', banned: false })

    expect(
      await unbanUserDiscord({
        guildId: 'guild-1',
        actorUserId: 'actor-1',
        actorIsElevated: false,
        targetUserId: 'target-1',
        targetHasManagerRole: false
      })
    ).toEqual({
      ok: false,
      code: 'NOT_BANNED',
      message: 'User is not banned.'
    })
  })

  it('returns not registered when target has no user record', async () => {
    expect(
      await unbanUserDiscord({
        guildId: 'guild-1',
        actorUserId: 'actor-1',
        actorIsElevated: true,
        targetUserId: 'missing-1',
        targetHasManagerRole: false
      })
    ).toEqual({
      ok: false,
      code: 'NOT_REGISTERED',
      message: 'User is not registered.'
    })
  })

  it('denies self unban attempts', async () => {
    expect(
      await unbanUserDiscord({
        guildId: 'guild-1',
        actorUserId: 'actor-1',
        actorIsElevated: false,
        targetUserId: 'actor-1',
        targetHasManagerRole: false
      })
    ).toEqual({
      ok: false,
      code: 'SELF',
      message: 'You cannot ban or unban yourself.'
    })
  })

  it('unbans without an active ban record or role sync', async () => {
    await createTestUser({ userId: 'target-2', banned: true })

    const result = await unbanUserDiscord({
      guildId: 'guild-1',
      actorUserId: 'actor-1',
      actorIsElevated: true,
      targetUserId: 'target-2',
      targetHasManagerRole: false
    })

    expect(result).toEqual({ ok: true, unbanReason: undefined })

    const user = await User.findOne({ guildId: 'guild-1', userId: 'target-2' })
    expect(user?.banned).toBe(false)
  })
})
