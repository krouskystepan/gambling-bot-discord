import { ApplicationCommandOptionType, ChannelType, MessageFlags } from 'discord.js';
import { handleUnexpectedInteractionError } from '@/errors';
import { createGuildConfiguration, getGuildConfigByGuildId } from '@/services';
import { createErrorEmbed, createSuccessEmbed } from '@/utils/discord/createEmbed';
export const data = {
    name: 'setup-prediction',
    description: 'Manage channels for predictions (actions & logs).',
    options: [
        {
            name: 'add-actions',
            description: 'Add a channel where predictions can be used.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel to add for prediction actions.',
                    type: ApplicationCommandOptionType.Channel,
                    channel_types: [ChannelType.GuildText],
                    required: true
                }
            ]
        },
        {
            name: 'remove-actions',
            description: 'Remove a channel from prediction actions.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel-id',
                    description: 'The ID of the channel to remove from prediction actions.',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        },
        {
            name: 'add-logs',
            description: 'Set a channel for prediction logs (results).',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel to set as prediction logs.',
                    type: ApplicationCommandOptionType.Channel,
                    channel_types: [ChannelType.GuildText],
                    required: true
                }
            ]
        },
        {
            name: 'remove-logs',
            description: 'Remove the prediction logs channel.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel-id',
                    description: 'The ID of the channel to remove from prediction logs.',
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
    deleted: false,
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
            const channel = options.getChannel('channel', true);
            if (guildConfiguration.predictionChannelIds.actions === channel.id) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('Prediction Channel Setup - Add Actions', `Channel ${channel} is already set for prediction actions.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            guildConfiguration.predictionChannelIds.actions = channel.id;
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('Prediction Channel Setup - Add Actions', `Channel ${channel} has been successfully set for prediction actions.`)
                ]
            });
        }
        if (subcommand === 'remove-actions') {
            const channelId = options.getString('channel-id', true);
            if (guildConfiguration.predictionChannelIds.actions !== channelId) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('Prediction Channel Setup - Remove Actions', `Channel with ID ${channelId} is not set for prediction actions.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            guildConfiguration.predictionChannelIds.actions = '';
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('Prediction Channel Setup - Remove Actions', `Channel with ID ${channelId} has been removed from prediction actions.`)
                ]
            });
        }
        if (subcommand === 'add-logs') {
            const channel = options.getChannel('channel', true);
            if (guildConfiguration.predictionChannelIds.logs === channel.id) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('Prediction Channel Setup - Add Logs', `Channel ${channel} is already set for prediction logs.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            guildConfiguration.predictionChannelIds.logs = channel.id;
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('Prediction Channel Setup - Add Logs', `Channel ${channel} has been successfully set for prediction logs.`)
                ]
            });
        }
        if (subcommand === 'remove-logs') {
            const channelId = options.getString('channel-id', true);
            if (guildConfiguration.predictionChannelIds.logs !== channelId) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('Prediction Channel Setup - Remove Logs', `Channel with ID ${channelId} is not set for prediction logs.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            guildConfiguration.predictionChannelIds.logs = '';
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('Prediction Channel Setup - Remove Logs', `Channel with ID ${channelId} has been removed from prediction logs.`)
                ]
            });
        }
    }
    catch (error) {
        await handleUnexpectedInteractionError(interaction, error);
    }
}
