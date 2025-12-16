import { TextChannel } from 'discord.js';
import { deleteVipByOwnerId, getAllActiveVips, getGuildConfigByGuildId } from '@/services';
import { createInfoEmbed } from '@/utils/createEmbed';
export default async (client) => {
    console.log('👀 VIP Room listener started');
    setInterval(async () => {
        const expiredRooms = await getAllActiveVips();
        for (const room of expiredRooms) {
            const guild = await client.guilds.fetch(room.guildId).catch(() => null);
            if (!guild)
                continue;
            const channel = await guild.channels
                .fetch(room.channelId)
                .catch(() => null);
            if (!channel || !(channel instanceof TextChannel))
                continue;
            if (room.ownerId) {
                await channel.permissionOverwrites
                    .edit(room.ownerId, { SendMessages: false })
                    .catch(() => null);
            }
            if (room.memberIds?.length) {
                for (const memberId of room.memberIds) {
                    await channel.permissionOverwrites
                        .edit(memberId, { SendMessages: false })
                        .catch(() => null);
                }
            }
            await channel
                .send({
                content: room.ownerId ? `<@${room.ownerId}>` : undefined,
                embeds: [
                    createInfoEmbed('VIP Channel Expired', '⏰ Your VIP time has expired. You no longer have access to this channel.')
                ]
            })
                .catch(() => null);
            const guildConfig = await getGuildConfigByGuildId({
                guildId: room.guildId
            });
            if (guildConfig?.vipSettings?.roleOwnerId && room.ownerId) {
                const owner = await guild.members.fetch(room.ownerId).catch(() => null);
                if (owner) {
                    await owner.roles
                        .remove(guildConfig.vipSettings.roleOwnerId, 'VIP expired')
                        .catch(() => null);
                }
            }
            if (guildConfig?.vipSettings?.roleMemberId && room.memberIds?.length) {
                for (const memberId of room.memberIds) {
                    const member = await guild.members.fetch(memberId).catch(() => null);
                    if (member) {
                        await member.roles
                            .remove(guildConfig.vipSettings.roleMemberId, 'VIP expired')
                            .catch(() => null);
                    }
                }
            }
            await deleteVipByOwnerId({
                ownerId: room.ownerId,
                guildId: room.guildId
            });
            console.log(`VIP channel ${room.channelId} expired.`);
        }
    }, 60_000);
};
