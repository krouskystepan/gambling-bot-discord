import { ApplicationCommandOptionType, ChannelType, MessageFlags } from 'discord.js';
import { createGuildConfiguration, getGuildConfigByGuildId } from '@/services';
import { createErrorEmbed, createSuccessEmbed } from '@/utils/discord/createEmbed';
export const data = {
    name: 'setup-atm',
    description: 'Manage ATM actions and logs channels.',
    options: [
        {
            name: 'add-actions',
            description: 'Set a channel for ATM transactions (deposits and withdrawals).',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel you want to set.',
                    type: ApplicationCommandOptionType.Channel,
                    channel_types: [ChannelType.GuildText],
                    required: true
                }
            ]
        },
        {
            name: 'remove-actions',
            description: 'Remove a channel for ATM transactions using its ID (deposits and withdrawals).',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel-id',
                    description: 'The ID of the channel you want to remove.',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        },
        {
            name: 'add-logs',
            description: 'Set a channel for ATM logs (transaction logs).',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel you want to set.',
                    type: ApplicationCommandOptionType.Channel,
                    channel_types: [ChannelType.GuildText],
                    required: true
                }
            ]
        },
        {
            name: 'remove-logs',
            description: 'Remove a channel for ATM logs using its ID (transaction logs).',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel-id',
                    description: 'The ID of the channel you want to remove.',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        }
    ],
    dm_permission: false
};
export const options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: true,
    devOnly: true
};
export async function run({ interaction }) {
    try {
        let guildConfiguration = await getGuildConfigByGuildId({
            guildId: interaction.guildId
        });
        if (!guildConfiguration) {
            guildConfiguration = await createGuildConfiguration({
                guildId: interaction.guildId
            });
        }
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        if (subcommand === 'add-actions') {
            const channel = interaction.options.getChannel('channel', true);
            if (guildConfiguration.atmChannelIds?.actions === channel.id) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('ATM Actions Channel Setup - Add', `Channel ${channel} is already set for ATM transactions.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            guildConfiguration.atmChannelIds.actions = channel.id;
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('ATM Actions Channel Setup - Add', `Channel ${channel} has been successfully set for ATM transactions.`)
                ]
            });
        }
        if (subcommand === 'remove-actions') {
            const channelId = options.getString('channel-id', true);
            if (guildConfiguration.atmChannelIds.actions !== channelId) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('ATM Actions Channel Setup - Remove', `Channel with ID ${channelId} is not set for ATM transactions.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            guildConfiguration.atmChannelIds.actions = '';
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('ATM Actions Channel Setup - Remove', `Channel with ID ${channelId} has been successfully removed from ATM transactions.`)
                ]
            });
        }
        if (subcommand === 'add-logs') {
            const channel = interaction.options.getChannel('channel', true);
            if (guildConfiguration.atmChannelIds?.logs === channel.id) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('ATM Logs Channel Setup - Add', `Channel ${channel} is already set for ATM logs.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            guildConfiguration.atmChannelIds.logs = channel.id;
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('ATM Logs Channel Setup - Add', `Channel ${channel} has been successfully set for ATM logs.`)
                ]
            });
        }
        if (subcommand === 'remove-logs') {
            const channelId = options.getString('channel-id', true);
            if (guildConfiguration.atmChannelIds.logs !== channelId) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('ATM Logs Channel Setup - Remove', `Channel with ID ${channelId} is not set for ATM logs.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            guildConfiguration.atmChannelIds.logs = '';
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('ATM Logs Channel Setup - Remove', `Channel with ID ${channelId} has been successfully removed from ATM logs.`)
                ]
            });
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
