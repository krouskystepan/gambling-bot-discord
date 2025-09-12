"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const VipRoom_1 = require("../../../models/VipRoom");
const User_1 = require("../../../models/User");
const createEmbed_1 = require("../../../utils/createEmbed");
const utils_1 = require("../../../utils/utils");
exports.data = {
    name: 'manage-vip',
    description: 'Admin commands to manage VIP rooms.',
    dm_permission: false,
    options: [
        {
            name: 'create-room',
            description: 'Create a VIP room for a user.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user who will receive the VIP room.',
                    type: discord_js_1.ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: 'duration',
                    description: 'Duration (e.g., 2d, 1w)',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            name: 'remove-room',
            description: 'Remove a user’s VIP room.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user whose VIP room should be removed.',
                    type: discord_js_1.ApplicationCommandOptionType.User,
                    required: true,
                },
            ],
        },
        {
            name: 'extend-room',
            description: 'Extend a user’s VIP room.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user whose VIP room should be extended.',
                    type: discord_js_1.ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: 'duration',
                    description: 'Extra duration to add (e.g., 2d, 1w)',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
    ],
};
exports.options = {
    botPermissions: ['Administrator'],
    deleted: false,
};
async function run({ interaction }) {
    try {
        const configReply = await (0, utils_1.checkChannelConfiguration)(interaction, 'transactionChannelId', {
            notSet: 'This server has not been configured for transactions.\nSet it up using web dashboard.',
            notAllowed: `This channel is not configured for transactions. Try one of these channels:`,
        });
        if (!configReply)
            return;
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const hasAdmin = member?.permissions.has('Administrator');
        const managerRoleId = configReply.managerRoleId;
        const hasManager = managerRoleId && member?.roles.cache.has(managerRoleId);
        if (!hasAdmin && !hasManager) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Permission Denied', `You need to be an **Administrator** or have the ${managerRoleId ? `<@&${managerRoleId}>` : '**Manager role**'} to use this command.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'create-room') {
            const targetedUser = interaction.options.getUser('user', true);
            const durationInput = interaction.options.getString('duration', true);
            if (targetedUser.bot) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Bot user', 'You cannot create a VIP room for bots.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const user = await User_1.default.findOne({
                userId: targetedUser.id,
                guildId: interaction.guildId,
            });
            if (!user) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Error - User Not Registered', 'This user has not registered yet. Use `/register` or `/force-register` first.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const existingVip = await VipRoom_1.default.findOne({
                userId: targetedUser.id,
                guildId: interaction.guildId,
                expiresAt: { $gt: new Date() },
            });
            if (existingVip) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('VIP Already Active', `User <@${targetedUser.id}> already has a VIP channel: <#${existingVip.channelId}>.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (!/^(\d+[dw])+$/i.test(durationInput)) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Duration', 'Format is invalid. Use whole numbers only, e.g., 1d, 2w.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const durationSeconds = (0, utils_1.parseTimeToSeconds)(durationInput);
            if (durationSeconds < 86400) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Duration Too Short', 'The duration must be at least 1 day (1d).'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const guild = interaction.guild;
            const categoryId = configReply.vipSettings.categoryId;
            const vipRoleId = configReply.vipSettings.roleId;
            const expiresAt = new Date(Date.now() + durationSeconds * 1000);
            const now = new Date();
            const day = now.getDate().toString().padStart(2, '0');
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const channel = await guild.channels.create({
                name: `vip-${targetedUser.username}-${day}-${month}`,
                type: discord_js_1.ChannelType.GuildText,
                parent: categoryId,
            });
            await channel.permissionOverwrites.edit(targetedUser.id, {
                ViewChannel: true,
                SendMessages: true,
            });
            const vipChannelCreatedMsg = await channel.send({
                content: `Welcome to your VIP channel, <@${targetedUser.id}>! 🎉`,
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('VIP Channel Ready', `Your channel <#${channel.id}> is valid until <t:${Math.floor(expiresAt.getTime() / 1000)}:f>`),
                ],
            });
            await vipChannelCreatedMsg.pin();
            const member = await guild.members.fetch(targetedUser.id);
            await member.roles.add(vipRoleId, `VIP created by admin ${interaction.user}`);
            await VipRoom_1.default.create({
                userId: targetedUser.id,
                guildId: interaction.guildId,
                channelId: channel.id,
                expiresAt,
            });
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('VIP Room Created', `VIP room <#${channel.id}> has been created for <@${targetedUser.id}>.\n` +
                        `It will expire <t:${Math.floor(expiresAt.getTime() / 1000)}:R>.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (subcommand === 'remove-room') {
            const targetedUser = interaction.options.getUser('user', true);
            if (targetedUser.bot) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Bot user', 'You cannot remove a VIP room for bot.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const existingVip = await VipRoom_1.default.findOne({
                userId: targetedUser.id,
                guildId: interaction.guildId,
                expiresAt: { $gt: new Date() },
            });
            if (!existingVip) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('VIP Not Active', `User <@${targetedUser.id}> does not currently have an active VIP room.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const channel = (await interaction
                .guild.channels.fetch(existingVip.channelId)
                .catch(() => null));
            if (channel && channel.isTextBased()) {
                await channel.permissionOverwrites
                    .edit(targetedUser.id, {
                    SendMessages: false,
                })
                    .catch(() => null);
                await channel
                    .send({
                    content: `<@${targetedUser.id}>`,
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('VIP Channel Removed', '⏰ Your VIP access has been removed. You no longer have access to this channel.'),
                    ],
                })
                    .catch(() => null);
            }
            const guildConfig = await GuildConfiguration_1.default.findOne({
                guildId: interaction.guildId,
            });
            if (guildConfig?.vipSettings?.roleId) {
                const member = await interaction
                    .guild.members.fetch(targetedUser.id)
                    .catch(() => null);
                if (member) {
                    await member.roles
                        .remove(guildConfig.vipSettings.roleId, 'VIP removed by admin')
                        .catch(() => null);
                }
            }
            await existingVip.deleteOne();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('VIP Removed', `The VIP of <@${targetedUser.id}> has been removed.\nChannel <#${existingVip.channelId}> is no longer accessible for them.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (subcommand === 'extend-room') {
            const targetedUser = interaction.options.getUser('user', true);
            const durationInput = interaction.options.getString('duration', true);
            if (targetedUser.bot) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Bot user', 'You cannot extend VIP for bots.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const existingVip = await VipRoom_1.default.findOne({
                userId: targetedUser.id,
                guildId: interaction.guildId,
                expiresAt: { $gt: new Date() },
            });
            if (!existingVip) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('VIP Not Active', `User <@${targetedUser.id}> does not currently have an active VIP room.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (!/^(\d+[dw])+$/i.test(durationInput)) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Format', 'Duration format is invalid. Use whole numbers only, e.g., 1d, 2w.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const durationSeconds = (0, utils_1.parseTimeToSeconds)(durationInput);
            if (durationSeconds < 86400) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Duration Too Short', 'The duration must be at least 1 day (1d).'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            existingVip.expiresAt = new Date(existingVip.expiresAt.getTime() + durationSeconds * 1000);
            await existingVip.save();
            const vipChannel = await interaction
                .guild.channels.fetch(existingVip.channelId)
                .catch(() => null);
            if (vipChannel?.isTextBased()) {
                const extendMsg = await vipChannel.send({
                    content: `<@${targetedUser.id}>`,
                    embeds: [
                        (0, createEmbed_1.createSuccessEmbed)('VIP Channel Extended', `Your VIP now expires on <t:${Math.floor(existingVip.expiresAt.getTime() / 1000)}:f>.`),
                    ],
                });
                await extendMsg.pin();
            }
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('VIP Extended', `The VIP of <@${targetedUser.id}> has been extended by **${durationSeconds / 86400} day(s)**.\n` +
                        `New expiry: <t:${Math.floor(existingVip.expiresAt.getTime() / 1000)}:f>`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
    catch (error) {
        console.error('Error running /manage-vip:', error);
    }
}
