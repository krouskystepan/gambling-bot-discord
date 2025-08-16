import { Client, TextChannel, PermissionsBitField } from 'discord.js'
import VipRoom from '../../models/VipRoom'
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
          embeds: [
            createInfoEmbed(
              'VIP Channel Expired',
              '⏰ Your VIP time has expired. You no longer have permission to send messages in this channel.'
            ),
          ],
        })
        .catch(() => null)

      await VipRoom.deleteOne({ _id: room._id })
      console.log(
        `VIP channel ${room.channelId} expired: write access removed.`
      )
    }
  }, 60_000)
}
