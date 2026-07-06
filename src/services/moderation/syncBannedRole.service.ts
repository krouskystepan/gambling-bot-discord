import User from '@/models/User'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

const ROLE_SYNC_DELAY_MS = 400

export type MemberForBannedRoleSync = {
  id: string
  guild: { id: string }
  roles: {
    cache: { has: (roleId: string) => boolean }
    add: (roleId: string, reason: string) => Promise<unknown>
    remove: (roleId: string, reason: string) => Promise<unknown>
  }
}

type GuildForBannedRoleSync = {
  id: string
  members: {
    fetch: (userId: string) => Promise<MemberForBannedRoleSync | null>
  }
  roles: {
    fetch: (roleId: string) => Promise<{
      members: { values: () => IterableIterator<MemberForBannedRoleSync> }
    } | null>
  }
}

export type SyncBannedRoleMemberResult =
  | 'added'
  | 'removed'
  | 'skipped'
  | 'error'

export type SyncGuildBannedRolesResult = {
  added: number
  removed: number
  skipped: number
  errors: number
}

export const syncBannedRoleForMember = async ({
  member,
  bannedRoleId,
  shouldBeBanned
}: {
  member: MemberForBannedRoleSync
  bannedRoleId: string
  shouldBeBanned: boolean
}): Promise<SyncBannedRoleMemberResult> => {
  if (!bannedRoleId) return 'skipped'

  const hasRole = member.roles.cache.has(bannedRoleId)

  try {
    if (shouldBeBanned && !hasRole) {
      await member.roles.add(bannedRoleId, 'Ban role sync')
      return 'added'
    }

    if (!shouldBeBanned && hasRole) {
      await member.roles.remove(bannedRoleId, 'Ban role sync')
      return 'removed'
    }

    return 'skipped'
  } catch (err) {
    logger.error(
      {
        err,
        guildId: member.guild.id,
        userId: member.id,
        action: shouldBeBanned ? 'add' : 'remove'
      },
      'Ban role sync failed for member'
    )
    return 'error'
  }
}

const recordMemberSync = async (
  result: SyncBannedRoleMemberResult,
  counts: SyncGuildBannedRolesResult
): Promise<void> => {
  switch (result) {
    case 'added':
      counts.added++
      await sleep(ROLE_SYNC_DELAY_MS)
      break
    case 'removed':
      counts.removed++
      await sleep(ROLE_SYNC_DELAY_MS)
      break
    case 'skipped':
      counts.skipped++
      break
    case 'error':
      counts.errors++
      break
  }
}

export const syncGuildBannedRoles = async ({
  guild,
  bannedRoleId
}: {
  guild: GuildForBannedRoleSync
  bannedRoleId: string
}): Promise<SyncGuildBannedRolesResult> => {
  const counts: SyncGuildBannedRolesResult = {
    added: 0,
    removed: 0,
    skipped: 0,
    errors: 0
  }

  if (!bannedRoleId) return counts

  const bannedUsers = await User.find({ guildId: guild.id, banned: true })
    .select('userId')
    .lean()

  for (const { userId } of bannedUsers) {
    const member = await guild.members.fetch(userId).catch(() => null)
    if (!member) continue

    const result = await syncBannedRoleForMember({
      member,
      bannedRoleId,
      shouldBeBanned: true
    })
    await recordMemberSync(result, counts)
  }

  const role = await guild.roles.fetch(bannedRoleId).catch(() => null)
  if (!role) {
    logger.error(
      { guildId: guild.id, bannedRoleId },
      'Ban role sync skipped: banned role not found'
    )
    return counts
  }

  for (const member of role.members.values()) {
    const user = await User.findOne({
      guildId: guild.id,
      userId: member.id
    })
      .select('banned')
      .lean()

    const shouldBeBanned = Boolean(user?.banned)

    const result = await syncBannedRoleForMember({
      member,
      bannedRoleId,
      shouldBeBanned
    })
    await recordMemberSync(result, counts)
  }

  return counts
}
