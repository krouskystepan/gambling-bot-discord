import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  deleteVipByOwnerId,
  getAllOldVips,
  getGuildConfigByGuildId
} from '@/services'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { sleep } from '@/utils/common/utils'
import { createWarningEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const vipExpirationJob = async (client: Client<true>) => {
  const expiredRooms = await getAllOldVips()
  if (!expiredRooms.length) return

  let processed = 0
  const guildCounts = new Map<
    string,
    { expired: number; channelMissed: number }
  >()

  for (const room of expiredRooms) {
    try {
      const guild = await client.guilds.fetch(room.guildId).catch(() => null)
      if (!guild) continue

      const guildConfig = await getGuildConfigByGuildId({
        guildId: room.guildId
      })

      if (guildConfig?.vipSettings?.roleOwnerId && room.ownerId) {
        const owner = await guild.members.fetch(room.ownerId).catch(() => null)
        if (owner) {
          await owner.roles
            .remove(guildConfig.vipSettings.roleOwnerId, 'VIP expired')
            .catch(() => null)
        }
      }

      if (guildConfig?.vipSettings?.roleMemberId && room.memberIds?.length) {
        for (const memberId of room.memberIds) {
          const member = await guild.members.fetch(memberId).catch(() => null)
          if (member) {
            await member.roles
              .remove(guildConfig.vipSettings.roleMemberId, 'VIP expired')
              .catch(() => null)
          }
        }
      }

      await deleteVipByOwnerId({
        ownerId: room.ownerId,
        guildId: room.guildId
      })

      processed++
      const stats = guildCounts.get(room.guildId) ?? {
        expired: 0,
        channelMissed: 0
      }
      stats.expired++
      guildCounts.set(room.guildId, stats)

      const channel = await guild.channels
        .fetch(room.channelId)
        .catch(() => null)
      if (channel?.type === ChannelType.GuildText) {
        if (room.ownerId) {
          await channel.permissionOverwrites
            .edit(room.ownerId, { SendMessages: false })
            .catch(() => null)
        }

        if (room.memberIds?.length) {
          for (const memberId of room.memberIds) {
            await channel.permissionOverwrites
              .edit(memberId, { SendMessages: false })
              .catch(() => null)
          }
        }

        await channel
          .send({
            content: room.ownerId ? `<@${room.ownerId}>` : undefined,
            embeds: [
              createWarningEmbed(
                'VIP Channel Expired',
                '⏰ Your VIP time has expired. You no longer have access to this channel.'
              )
            ]
          })
          .catch(() => null)
      } else {
        stats.channelMissed++
      }

      await sleep(500)
    } catch (err) {
      logger.error(`VIP expiration failed for channel ${room.channelId}`, err)
    }
  }

  if (processed > 0) {
    const guildRoomCounts = new Map(
      [...guildCounts.entries()].map(([guildId, stats]) => [
        guildId,
        stats.expired
      ])
    )
    logMultiGuildCountSummary({
      client,
      job: 'VIP expiration',
      verb: 'processed',
      total: processed,
      unit: 'room(s)',
      guildCounts: guildRoomCounts
    })

    for (const [guildId, stats] of guildCounts) {
      const description = [
        'VIP time ran out. Roles were removed and channels were locked.',
        stats.channelMissed > 0
          ? `**${stats.channelMissed}** room(s) could not be updated in Discord.`
          : null
      ]
        .filter(Boolean)
        .join('\n\n')

      await postWorkerLog(client, {
        guildId,
        worker: 'VIP rooms',
        title: `Expired ${stats.expired} VIP room(s)`,
        description,
        level: stats.channelMissed > 0 ? 'warning' : 'info'
      })
    }
  }
}
