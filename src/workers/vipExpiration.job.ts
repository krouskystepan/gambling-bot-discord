import { ChannelType } from 'discord.js'

import { Client } from 'commandkit'

import {
  deleteVipByOwnerId,
  getAllOldVips,
  getGuildConfigByGuildId
} from '@/services'
import { sleep } from '@/utils/common/utils'
import { createInfoEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const vipExpirationJob = async (client: Client<true>) => {
  const expiredRooms = await getAllOldVips()
  if (!expiredRooms.length) return

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
            createInfoEmbed(
              'VIP Channel Expired',
              '⏰ Your VIP time has expired. You no longer have access to this channel.'
            )
          ]
        })
        .catch(() => null)

      logger.worker(`VIP channel ${room.channelId} expired.`)

      await sleep(500)
    } catch (err) {
      logger.error(`VIP expiration failed for channel ${room.channelId}`, err)
    }
  }
}
