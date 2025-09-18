"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const VipRoom_1 = require("../../../models/VipRoom");
const User_1 = require("../../../models/User");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
const utils_1 = require("../../../utils/utils");
const Transaction_1 = require("../../../models/Transaction");
exports.data = {
    name: 'vip',
    description: 'VIP management commands.',
    dm_permission: false,
    options: [
        {
            name: 'buy',
            description: 'Purchase a VIP room for a specified duration.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'duration',
                    description: 'Duration (e.g., 2d, 1w)',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            name: 'extend',
            description: 'Extend your current VIP duration.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'duration',
                    description: 'Extra duration to add (e.g., 2d, 1w)',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            name: 'info',
            description: 'Show VIP info, price and how long you can afford it.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
        },
    ],
};
exports.options = {
    deleted: false,
};
async function run({ interaction }) {
    try {
        const guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration?.vipSettings.categoryId ||
            guildConfiguration.vipSettings.pricePerDay === 0) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('VIP Not Configured', 'VIP category or price is not set yet. Please contact administrator.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const user = await User_1.default.findOne({
            userId: interaction.user.id,
            guildId: interaction.guildId,
        });
        if (!user) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not Registered', 'You must register first using /register.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const subcommand = interaction.options.getSubcommand();
        const pricePerDay = guildConfiguration.vipSettings.pricePerDay;
        const pricePerCreate = guildConfiguration.vipSettings.pricePerCreate;
        if (subcommand === 'info') {
            const maxDays = Math.floor(user.balance / pricePerDay);
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('VIP Info', (pricePerCreate > 0
                        ? `Price per create: **$${(0, utils_1.formatNumberToReadableString)(pricePerCreate)}**\n`
                        : '') +
                        `Price per day: **$${(0, utils_1.formatNumberToReadableString)(pricePerDay)}**\n\n` +
                        `Your balance: **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**\n` +
                        `You can afford VIP for up to **${maxDays} day(s)** (excluding creation fee).`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (subcommand === 'buy') {
            const existingVip = await VipRoom_1.default.findOne({
                userId: interaction.user.id,
                guildId: interaction.guildId,
                expiresAt: { $gt: new Date() },
            });
            if (existingVip) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('VIP Already Active', `You already have a VIP channel <#${existingVip.channelId}>.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const durationInput = interaction.options.getString('duration', true);
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
            const durationDays = durationSeconds / 86400;
            let totalPrice = durationDays * pricePerDay;
            if (pricePerCreate > 0) {
                totalPrice += pricePerCreate;
            }
            const affordableDays = Math.floor(user.balance / pricePerDay);
            if (user.balance < totalPrice) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Insufficient Funds', `You cannot afford VIP for ${durationDays} day(s).\n` +
                            `Your balance: **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**\n` +
                            (pricePerCreate > 0
                                ? `Creation fee: **$${(0, utils_1.formatNumberToReadableString)(pricePerCreate)}**\n`
                                : '') +
                            `You can afford VIP for up to **${affordableDays} day(s)** (excluding creation fee).`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            const durationMs = durationSeconds * 1000;
            const guild = interaction.guild;
            const categoryId = guildConfiguration.vipSettings.categoryId;
            const vipRoleId = guildConfiguration.vipSettings.roleId;
            const now = new Date();
            const day = now.getDate().toString().padStart(2, '0');
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const channel = await guild.channels.create({
                name: `vip-${interaction.user.username}-${day}-${month}`,
                type: discord_js_1.ChannelType.GuildText,
                parent: categoryId,
            });
            await channel.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
            });
            const expiresAt = new Date(Date.now() + durationMs);
            const vipChannelCreatedMsg = await channel.send({
                content: `Welcome to your VIP channel, ${interaction.user}! 🎉`,
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('VIP Channel Ready', `Your channel <#${channel.id}> is valid until <t:${Math.floor(expiresAt.getTime() / 1000)}:f>`),
                ],
            });
            await vipChannelCreatedMsg.pin();
            const member = await guild.members.fetch(interaction.user.id);
            await member.roles.add(vipRoleId, 'VIP purchased via /vip buy');
            await VipRoom_1.default.findOneAndUpdate({ userId: interaction.user.id, guildId: interaction.guildId }, {
                channelId: channel.id,
                expiresAt,
            }, { upsert: true });
            await User_1.default.findOneAndUpdate({ userId: user.userId, guildId: user.guildId }, { $inc: { balance: -totalPrice } });
            await Transaction_1.default.create({
                userId: user.userId,
                guildId: user.guildId,
                amount: totalPrice,
                type: 'vip',
                source: 'system',
                meta: {
                    action: 'buy',
                    durationDays: durationDays,
                },
                createdAt: new Date(),
            });
            return interaction.editReply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('VIP Purchased', `Your VIP room <#${channel.id}> has been created for **${durationDays} day(s)**.\n` +
                        `You have been charged **$${(0, utils_1.formatNumberToReadableString)(totalPrice)}**.` +
                        (pricePerCreate > 0
                            ? ` (including a creation fee of **$${(0, utils_1.formatNumberToReadableString)(pricePerCreate)}**)`
                            : '')),
                ],
            });
        }
        if (subcommand === 'extend') {
            const existingVip = await VipRoom_1.default.findOne({
                userId: interaction.user.id,
                guildId: interaction.guildId,
                expiresAt: { $gt: new Date() },
            });
            if (!existingVip) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('VIP Not Active', 'You do not currently have an active VIP to extend.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const durationInput = interaction.options.getString('duration', true);
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
            const durationDays = durationSeconds / 86400;
            const totalPrice = durationDays * pricePerDay;
            const affordableDays = Math.floor(user.balance / pricePerDay);
            if (user.balance < totalPrice) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Insufficient Funds', `You cannot afford to extend VIP for ${durationDays} day(s).\n` +
                            `Your balance: **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**\n` +
                            `You can afford VIP for up to **${affordableDays} day(s)**.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const newExpiry = new Date(existingVip.expiresAt.getTime() + durationSeconds * 1000);
            await Promise.all([
                VipRoom_1.default.findOneAndUpdate({ _id: existingVip._id }, { $set: { expiresAt: newExpiry } }),
                User_1.default.findOneAndUpdate({ userId: user.userId, guildId: user.guildId }, { $inc: { balance: -totalPrice } }),
            ]);
            await Transaction_1.default.create({
                userId: user.userId,
                guildId: user.guildId,
                amount: totalPrice,
                type: 'vip',
                source: 'system',
                meta: {
                    action: 'extend',
                    durationDays: durationDays,
                },
                createdAt: new Date(),
            });
            const vipChannel = await interaction.guild.channels.fetch(existingVip.channelId);
            if (vipChannel?.isTextBased()) {
                const extendMsg = await vipChannel.send({
                    content: `Your VIP has been extended, ${interaction.user}! 🎉`,
                    embeds: [
                        (0, createEmbed_1.createSuccessEmbed)('VIP Channel Extended', `New expiry: <t:${Math.floor(existingVip.expiresAt.getTime() / 1000)}:f>`),
                    ],
                });
                await extendMsg.pin();
            }
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('VIP Extended', `Your VIP has been extended by **${durationDays} day(s)**.\n` +
                        `New expiry: <t:${Math.floor(existingVip.expiresAt.getTime() / 1000)}:f>\n` +
                        `You have been charged **$${(0, utils_1.formatNumberToReadableString)(totalPrice)}**.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
    catch (error) {
        console.error('Error running /vip:', error);
    }
}
