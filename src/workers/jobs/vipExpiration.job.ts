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

export const vipExpirationJob = async (client: Client<true>) => {
  const expiredRooms = await getAllOldVips()
  if (!expiredRooms.length) return

  let processed = 0
  const guildCounts = new Map<string, number>()

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

      const channel = await guild.channels
        .fetch(room.channelId)
        .catch(() => null)
      if (!channel || channel.type !== ChannelType.GuildText) continue

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

      processed++
      guildCounts.set(room.guildId, (guildCounts.get(room.guildId) ?? 0) + 1)

      await sleep(500)
    } catch (err) {
      logger.error(`VIP expiration failed for channel ${room.channelId}`, err)
    }
  }

  if (processed > 0) {
    logger.worker(`VIP expiration: processed ${processed}`)

    for (const [guildId, count] of guildCounts) {
      await postWorkerLog(client, {
        guildId,
        worker: 'VIP expiration',
        title: `Processed ${count} room(s)`,
        description:
          'Roles removed, permissions revoked, and expiry notices sent in VIP channels.',
        level: 'warning'
      })
    }
  }
}
