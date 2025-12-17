import { ApplicationCommandOptionType, ChannelType, MessageFlags } from 'discord.js';
import { handleUnexpectedInteractionError } from '@/errors';
import { addMemberToVip, createTransaction, createVip, extendVipExpiry, getActiveVipByOwner, getGuildConfigByGuildId, getUser, removeMemberFromVip, updateUserBalance } from '@/services';
import { formatNumberToReadableString, parseTimeToSeconds } from '@/utils/common/utils';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '@/utils/discord/createEmbed';
export const data = {
    name: 'vip',
    description: 'VIP management commands.',
    dm_permission: false,
    options: [
        {
            name: 'info',
            description: 'Show VIP info.',
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: 'buy',
            description: 'Purchase a VIP room for a specified duration.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'duration',
                    description: 'Duration (e.g., 2d, 1w)',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        },
        {
            name: 'extend',
            description: 'Extend your current VIP duration.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'duration',
                    description: 'Extra duration to add (e.g., 2d, 1w)',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        },
        {
            name: 'add-member',
            description: 'Add a user to your VIP room.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'User to add to your VIP room.',
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: 'remove-member',
            description: 'Remove a user from your VIP room.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'User to remove from your VIP room.',
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        }
    ]
};
export const options = {
    deleted: false
};
export async function run({ interaction }) {
    try {
        const guildConfiguration = await getGuildConfigByGuildId({
            guildId: interaction.guildId
        });
        if (!guildConfiguration) {
            return interaction.reply({
                embeds: [
                    createErrorEmbed('Guild Not Configured', 'This guild has not been configured yet. Please contact administrator.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        if (!guildConfiguration.vipSettings.categoryId ||
            guildConfiguration.vipSettings.pricePerDay === 0 ||
            !guildConfiguration.vipSettings.roleOwnerId ||
            !guildConfiguration.vipSettings.roleMemberId) {
            return interaction.reply({
                embeds: [
                    createErrorEmbed('VIP Not Configured', 'VIP category, price or VIP roles are not set yet. Please contact administrator.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        const user = await getUser({
            userId: interaction.user.id,
            guildId: interaction.guildId
        });
        if (!user) {
            return interaction.reply({
                embeds: [
                    createErrorEmbed('Error - Not Registered', 'You must register first using /register.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        const subcommand = interaction.options.getSubcommand();
        const pricePerDay = guildConfiguration.vipSettings.pricePerDay;
        const pricePerCreate = guildConfiguration.vipSettings.pricePerCreate;
        const vipRoleOwnerId = guildConfiguration.vipSettings.roleOwnerId;
        const vipRoleMemberId = guildConfiguration.vipSettings.roleMemberId;
        if (subcommand === 'info') {
            const maxDays = Math.floor(user.balance / pricePerDay);
            const vipRoom = await getActiveVipByOwner({
                ownerId: interaction.user.id,
                guildId: interaction.guildId
            });
            let vipInfoSection = '';
            if (vipRoom) {
                const ownerMention = `<@${vipRoom.ownerId}>`;
                const memberMentions = vipRoom.memberIds.length > 0
                    ? vipRoom.memberIds.map((id) => `<@${id}>`).join(', ')
                    : '_No additional members_';
                vipInfoSection =
                    `\n**Your VIP Room:** <#${vipRoom.channelId}>\n` +
                        `**Owner:** ${ownerMention}\n` +
                        `**Members:** ${memberMentions}\n` +
                        `**Expires:** <t:${Math.floor(vipRoom.expiresAt.getTime() / 1000)}:f>\n\n`;
            }
            return interaction.reply({
                embeds: [
                    createInfoEmbed('VIP Info', vipInfoSection +
                        (pricePerCreate > 0
                            ? `Price per create: **$${formatNumberToReadableString(pricePerCreate)}**\n`
                            : '') +
                        `Price per day: **$${formatNumberToReadableString(pricePerDay)}**\n\n` +
                        `Your balance: **$${formatNumberToReadableString(user.balance)}**\n` +
                        `You can afford VIP for up to **${maxDays} day(s)** (excluding creation fee).`)
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        if (subcommand === 'buy') {
            const vipRoom = await getActiveVipByOwner({
                ownerId: interaction.user.id,
                guildId: interaction.guildId
            });
            if (vipRoom) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('VIP Already Active', `You already are Owner of VIP channel <#${vipRoom.channelId}>.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const durationInput = interaction.options.getString('duration', true);
            if (!/^(\d+[dw])+$/i.test(durationInput)) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Invalid Input - Invalid Format', 'Duration format is invalid. Use whole numbers only, e.g., 1d, 2w.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const durationSeconds = parseTimeToSeconds(durationInput);
            if (durationSeconds < 86400) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Invalid Input - Duration Too Short', 'The duration must be at least 1 day (1d).')
                    ],
                    flags: MessageFlags.Ephemeral
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
                        createInfoEmbed('Insufficient Funds', `You cannot afford VIP for ${durationDays} day(s).\n` +
                            `Your balance: **$${formatNumberToReadableString(user.balance)}**\n` +
                            (pricePerCreate > 0
                                ? `Creation fee: **$${formatNumberToReadableString(pricePerCreate)}**\n`
                                : '') +
                            `You can afford VIP for up to **${affordableDays} day(s)** (excluding creation fee).`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const durationMs = durationSeconds * 1000;
            const guild = interaction.guild;
            const categoryId = guildConfiguration.vipSettings.categoryId;
            const now = new Date();
            const day = now.getDate().toString().padStart(2, '0');
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const channel = await guild.channels.create({
                name: `vip-${interaction.user.username}-${day}-${month}`,
                type: ChannelType.GuildText,
                parent: categoryId
            });
            await channel.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true
            });
            const expiresAt = new Date(Date.now() + durationMs);
            const vipChannelCreatedMsg = await channel.send({
                content: `Welcome to your VIP channel, ${interaction.user}! 🎉`,
                embeds: [
                    createSuccessEmbed('VIP Channel Ready', `Your channel <#${channel.id}> is valid until <t:${Math.floor(expiresAt.getTime() / 1000)}:f>`)
                ]
            });
            await vipChannelCreatedMsg.pin();
            const member = await guild.members.fetch(interaction.user.id);
            await member.roles.add(vipRoleOwnerId, 'VIP purchased via /vip buy');
            console.log(expiresAt.toLocaleString('cs-CZ'));
            await createVip({
                ownerId: interaction.user.id,
                guildId: interaction.guildId,
                channelId: channel.id,
                expiresAt
            });
            await updateUserBalance({
                userId: interaction.user.id,
                guildId: interaction.guildId,
                amount: -totalPrice
            });
            await createTransaction({
                userId: interaction.user.id,
                guildId: interaction.guildId,
                amount: totalPrice,
                type: 'vip',
                source: 'system',
                meta: {
                    action: 'buy',
                    durationDays: durationDays
                }
            });
            return interaction.editReply({
                embeds: [
                    createSuccessEmbed('VIP Purchased', `Your VIP room <#${channel.id}> has been created for **${durationDays} day(s)**.\n` +
                        `You have been charged **$${formatNumberToReadableString(totalPrice)}**.` +
                        (pricePerCreate > 0
                            ? ` (including a creation fee of **$${formatNumberToReadableString(pricePerCreate)}**)`
                            : ''))
                ]
            });
        }
        if (subcommand === 'extend') {
            const existingVip = await getActiveVipByOwner({
                ownerId: interaction.user.id,
                guildId: interaction.guildId
            });
            if (!existingVip) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('VIP Not Active', 'You do not currently have an active VIP to extend.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const durationInput = interaction.options.getString('duration', true);
            if (!/^(\d+[dw])+$/i.test(durationInput)) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Invalid Input - Invalid Format', 'Duration format is invalid. Use whole numbers only, e.g., 1d, 2w.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const durationSeconds = parseTimeToSeconds(durationInput);
            if (durationSeconds < 86400) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Invalid Input - Duration Too Short', 'The duration must be at least 1 day (1d).')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const durationDays = durationSeconds / 86400;
            const totalPrice = durationDays * pricePerDay;
            const affordableDays = Math.floor(user.balance / pricePerDay);
            if (user.balance < totalPrice) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Insufficient Funds', `You cannot afford to extend VIP for ${durationDays} day(s).\n` +
                            `Your balance: **$${formatNumberToReadableString(user.balance)}**\n` +
                            `You can afford VIP for up to **${affordableDays} day(s)**.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const newExpiry = new Date(existingVip.expiresAt.getTime() + durationSeconds * 1000);
            await Promise.all([
                await extendVipExpiry({
                    ownerId: user.userId,
                    guildId: user.guildId,
                    newExpiry
                }),
                updateUserBalance({
                    userId: user.userId,
                    guildId: user.guildId,
                    amount: -totalPrice
                })
            ]);
            await createTransaction({
                userId: user.userId,
                guildId: user.guildId,
                amount: totalPrice,
                type: 'vip',
                source: 'system',
                meta: {
                    action: 'extend',
                    durationDays: durationDays
                }
            });
            const vipChannel = await interaction.guild.channels.fetch(existingVip.channelId);
            if (vipChannel?.isTextBased()) {
                const extendMsg = await vipChannel.send({
                    content: `Your VIP has been extended, ${interaction.user}! 🎉`,
                    embeds: [
                        createSuccessEmbed('VIP Channel Extended', `New expiry: <t:${Math.floor(existingVip.expiresAt.getTime() / 1000)}:f>`)
                    ]
                });
                await extendMsg.pin();
            }
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('VIP Extended', `Your VIP has been extended by **${durationDays} day(s)**.\n` +
                        `New expiry: <t:${Math.floor(existingVip.expiresAt.getTime() / 1000)}:f>\n` +
                        `You have been charged **$${formatNumberToReadableString(totalPrice)}**.`)
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        if (subcommand === 'add-member') {
            const vipRoom = await getActiveVipByOwner({
                ownerId: interaction.user.id,
                guildId: interaction.guildId
            });
            if (!vipRoom) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('No Active VIP', 'You must own an active VIP room to add members.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            if (guildConfiguration.vipSettings.pricePerAdditionalMember === 0) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('Adding Members Disabled', 'The server administrator has disabled adding additional VIP members.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const userToAdd = interaction.options.getUser('user', true);
            if (userToAdd.id === interaction.user.id) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Not Allowed', 'You are already the owner of this VIP room.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            if (vipRoom.memberIds.includes(userToAdd.id)) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Already Added', `${userToAdd} is already a member of your VIP room.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            if (vipRoom.memberIds.length >= guildConfiguration.vipSettings.maxMembers) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('VIP Full', `Your VIP room is full. Max members allowed: **${guildConfiguration.vipSettings.maxMembers}**`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const additionalMemberPrice = guildConfiguration.vipSettings.pricePerAdditionalMember ?? 0;
            if (user.balance < additionalMemberPrice) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('Insufficient Funds', `Adding a VIP member costs **$${formatNumberToReadableString(additionalMemberPrice)}**, but you only have **$${formatNumberToReadableString(user.balance)}**.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await updateUserBalance({
                userId: user.userId,
                guildId: user.guildId,
                amount: -additionalMemberPrice
            });
            await addMemberToVip({
                ownerId: user.userId,
                guildId: user.guildId,
                memberId: userToAdd.id
            });
            const guild = interaction.guild;
            const member = await guild.members.fetch(userToAdd.id);
            await member.roles.add(vipRoleMemberId);
            const channel = guild.channels.cache.get(vipRoom.channelId);
            if (channel && channel.isTextBased() && !channel.isThread()) {
                await channel.permissionOverwrites.edit(userToAdd.id, {
                    ViewChannel: true,
                    SendMessages: true
                });
            }
            await createTransaction({
                userId: user.userId,
                guildId: user.guildId,
                amount: additionalMemberPrice,
                type: 'vip',
                source: 'system',
                meta: {
                    action: 'add-member',
                    addedUserId: userToAdd.id
                }
            });
            return interaction.editReply({
                embeds: [
                    createSuccessEmbed('Member Added', `${userToAdd} has been added to your VIP room.\n` +
                        `Charge: **$${formatNumberToReadableString(additionalMemberPrice)}**`)
                ]
            });
        }
        if (subcommand === 'remove-member') {
            const vipRoom = await getActiveVipByOwner({
                ownerId: interaction.user.id,
                guildId: interaction.guildId
            });
            if (!vipRoom) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('No Active VIP', 'You must own an active VIP room to remove members.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const userToRemove = interaction.options.getUser('user', true);
            if (!vipRoom.memberIds.includes(userToRemove.id)) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Not a Member', `${userToRemove} is not a member of your VIP room.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await removeMemberFromVip({
                ownerId: interaction.user.id,
                guildId: interaction.guildId,
                memberId: userToRemove.id
            });
            const guild = interaction.guild;
            const member = await guild.members
                .fetch(userToRemove.id)
                .catch(() => null);
            if (member) {
                await member.roles.remove(vipRoleMemberId).catch(() => undefined);
            }
            const channel = guild.channels.cache.get(vipRoom.channelId);
            if (channel && channel.isTextBased() && !channel.isThread()) {
                await channel.permissionOverwrites
                    .edit(userToRemove.id, {
                    ViewChannel: false,
                    SendMessages: false
                })
                    .catch(() => undefined);
            }
            await createTransaction({
                userId: interaction.user.id,
                guildId: interaction.guildId,
                amount: 0,
                type: 'vip',
                source: 'system',
                meta: {
                    action: 'remove-member',
                    removedUserId: userToRemove.id
                }
            });
            return interaction.editReply({
                embeds: [
                    createSuccessEmbed('Member Removed', `${userToRemove} has been removed from your VIP room.`)
                ]
            });
        }
    }
    catch (error) {
        await handleUnexpectedInteractionError(interaction, error);
    }
}
