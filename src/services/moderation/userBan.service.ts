import { generateId } from 'gambling-bot-shared/common'
import {
  MODERATION_MANAGER_TARGET_ERROR,
  MODERATION_SELF_ERROR,
  canModerateUserTarget,
  normalizeBanReason
} from 'gambling-bot-shared/user'

import User from '@/models/User'
import UserBan from '@/models/UserBan'

import {
  MemberForBannedRoleSync,
  syncBannedRoleForMember
} from './syncBannedRole.service'

export type UserBanServiceErrorCode =
  | 'SELF'
  | 'MANAGER_TARGET'
  | 'NOT_REGISTERED'
  | 'ALREADY_BANNED'
  | 'NOT_BANNED'

export type BanUserDiscordResult =
  | { ok: true; banReason?: string }
  | { ok: false; code: UserBanServiceErrorCode; message: string }

export type UnbanUserDiscordResult =
  | { ok: true; unbanReason?: string }
  | { ok: false; code: UserBanServiceErrorCode; message: string }

const moderationErrorMessage = (code: 'SELF' | 'MANAGER_TARGET') =>
  code === 'SELF' ? MODERATION_SELF_ERROR : MODERATION_MANAGER_TARGET_ERROR

export async function banUserDiscord({
  guildId,
  actorUserId,
  actorIsElevated,
  targetUserId,
  targetHasManagerRole,
  reason,
  guildMember,
  bannedRoleId
}: {
  guildId: string
  actorUserId: string
  actorIsElevated: boolean
  targetUserId: string
  targetHasManagerRole: boolean
  reason?: string
  guildMember?: MemberForBannedRoleSync | null
  bannedRoleId?: string | null
}): Promise<BanUserDiscordResult> {
  const guard = canModerateUserTarget({
    actorUserId,
    actorIsElevated,
    targetUserId,
    targetHasManagerRole
  })

  if (!guard.ok) {
    return {
      ok: false,
      code: guard.code,
      message: moderationErrorMessage(guard.code)
    }
  }

  const user = await User.findOne({ guildId, userId: targetUserId })

  if (!user) {
    return {
      ok: false,
      code: 'NOT_REGISTERED',
      message: 'User is not registered.'
    }
  }

  if (user.banned) {
    return {
      ok: false,
      code: 'ALREADY_BANNED',
      message: 'User is already banned.'
    }
  }

  const banReason = normalizeBanReason(reason)
  const now = new Date()

  await UserBan.create({
    banId: generateId(),
    guildId,
    userId: targetUserId,
    bannedAt: now,
    bannedBy: actorUserId,
    banReason,
    unbannedAt: null,
    unbannedBy: null
  })

  user.banned = true
  user.bannedAt = now
  user.bannedBy = actorUserId
  await user.save()

  if (guildMember && bannedRoleId) {
    await syncBannedRoleForMember({
      member: guildMember,
      bannedRoleId,
      shouldBeBanned: true
    })
  }

  return { ok: true, banReason }
}

export async function unbanUserDiscord({
  guildId,
  actorUserId,
  actorIsElevated,
  targetUserId,
  targetHasManagerRole,
  reason,
  guildMember,
  bannedRoleId
}: {
  guildId: string
  actorUserId: string
  actorIsElevated: boolean
  targetUserId: string
  targetHasManagerRole: boolean
  reason?: string
  guildMember?: MemberForBannedRoleSync | null
  bannedRoleId?: string | null
}): Promise<UnbanUserDiscordResult> {
  const guard = canModerateUserTarget({
    actorUserId,
    actorIsElevated,
    targetUserId,
    targetHasManagerRole
  })

  if (!guard.ok) {
    return {
      ok: false,
      code: guard.code,
      message: moderationErrorMessage(guard.code)
    }
  }

  const [user, activeBan] = await Promise.all([
    User.findOne({ guildId, userId: targetUserId }),
    UserBan.findOne({ guildId, userId: targetUserId, unbannedAt: null }).sort({
      bannedAt: -1
    })
  ])

  if (!user) {
    return {
      ok: false,
      code: 'NOT_REGISTERED',
      message: 'User is not registered.'
    }
  }

  if (!user.banned) {
    return {
      ok: false,
      code: 'NOT_BANNED',
      message: 'User is not banned.'
    }
  }

  const unbanReason = normalizeBanReason(reason)
  const now = new Date()

  if (activeBan) {
    activeBan.unbannedAt = now
    activeBan.unbannedBy = actorUserId
    activeBan.unbanReason = unbanReason
    await activeBan.save()
  }

  user.banned = false
  user.bannedAt = null
  user.bannedBy = null
  await user.save()

  if (guildMember && bannedRoleId) {
    await syncBannedRoleForMember({
      member: guildMember,
      bannedRoleId,
      shouldBeBanned: false
    })
  }

  return { ok: true, unbanReason }
}

export function resolveTargetHasManagerRole({
  managerRoleId,
  guildMember
}: {
  managerRoleId?: string | null
  guildMember?: {
    roles: { cache: { has: (roleId: string) => boolean } }
  } | null
}): boolean {
  return Boolean(managerRoleId && guildMember?.roles.cache.has(managerRoleId))
}
