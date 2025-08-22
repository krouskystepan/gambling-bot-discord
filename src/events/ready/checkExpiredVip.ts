import { Client, TextChannel } from 'discord.js'
import VipRoom from '../../models/VipRoom'
import GuildConfiguration from '../../models/GuildConfiguration'
import { createInfoEmbed } from '../../utils/createEmbed'

export default async (client: Client) => {
  setInterval(async () => {
    const now = new Date()
    const expiredRooms = await VipRoom.find({ expiresAt: { $lte: now } })

    for (const room of expiredRooms) {
      const guild = await client.guilds.fetch(room.guildId).catch(() => null)
      if (!guild) continue

      const channel = await guild.channels
        .fetch(room.channelId)
        .catch(() => null)

      if (!channel || !(channel instanceof TextChannel)) continue

      if (room.userId) {
        await channel.permissionOverwrites
          .edit(room.userId, {
            SendMessages: false,
          })
          .catch(() => null)
      }

      await channel
        .send({
          content: `<@${room.userId}>`,
          embeds: [
            createInfoEmbed(
              'VIP Channel Expired',
              '⏰ Your VIP time has expired. You no longer have access to this channel.'
            ),
          ],
        })
        .catch(() => null)

      const guildConfig = await GuildConfiguration.findOne({
        guildId: room.guildId,
      })
      if (guildConfig?.vipSettings?.roleId && room.userId) {
        const member = await guild.members.fetch(room.userId).catch(() => null)
        if (member) {
          await member.roles
            .remove(guildConfig.vipSettings.roleId, 'VIP expired')
            .catch(() => null)
        }
      }

      await VipRoom.deleteOne({ _id: room._id })
      console.log(`VIP channel ${room.channelId} expired.`)
    }
  }, 60_000)
}
