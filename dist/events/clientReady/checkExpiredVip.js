"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const VipRoom_1 = require("../../models/VipRoom");
const GuildConfiguration_1 = require("../../models/GuildConfiguration");
const createEmbed_1 = require("../../utils/createEmbed");
exports.default = async (client) => {
    console.log('👀 VIP Room listener started');
    setInterval(async () => {
        const now = new Date();
        const expiredRooms = await VipRoom_1.default.find({ expiresAt: { $lte: now } });
        for (const room of expiredRooms) {
            const guild = await client.guilds.fetch(room.guildId).catch(() => null);
            if (!guild)
                continue;
            const channel = await guild.channels
                .fetch(room.channelId)
                .catch(() => null);
            if (!channel || !(channel instanceof discord_js_1.TextChannel))
                continue;
            if (room.userId) {
                await channel.permissionOverwrites
                    .edit(room.userId, {
                    SendMessages: false,
                })
                    .catch(() => null);
            }
            await channel
                .send({
                content: `<@${room.userId}>`,
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('VIP Channel Expired', '⏰ Your VIP time has expired. You no longer have access to this channel.'),
                ],
            })
                .catch(() => null);
            const guildConfig = await GuildConfiguration_1.default.findOne({
                guildId: room.guildId,
            });
            if (guildConfig?.vipSettings?.roleId && room.userId) {
                const member = await guild.members.fetch(room.userId).catch(() => null);
                if (member) {
                    await member.roles
                        .remove(guildConfig.vipSettings.roleId, 'VIP expired')
                        .catch(() => null);
                }
            }
            await VipRoom_1.default.deleteOne({ _id: room._id });
            console.log(`VIP channel ${room.channelId} expired.`);
        }
    }, 60_000);
};
