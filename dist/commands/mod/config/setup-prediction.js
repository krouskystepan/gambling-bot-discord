"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'setup-prediction',
    description: 'Manage channels for predictions (actions & logs).',
    options: [
        {
            name: 'add-actions',
            description: 'Add a channel where predictions can be used.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel to add for prediction actions.',
                    type: discord_js_1.ApplicationCommandOptionType.Channel,
                    channel_types: [discord_js_1.ChannelType.GuildText],
                    required: true,
                },
            ],
        },
        {
            name: 'remove-actions',
            description: 'Remove a channel from prediction actions.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel-id',
                    description: 'The ID of the channel to remove from prediction actions.',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            name: 'add-logs',
            description: 'Set a channel for prediction logs (results).',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel to set as prediction logs.',
                    type: discord_js_1.ApplicationCommandOptionType.Channel,
                    channel_types: [discord_js_1.ChannelType.GuildText],
                    required: true,
                },
            ],
        },
        {
            name: 'remove-logs',
            description: 'Remove the prediction logs channel.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel-id',
                    description: 'The ID of the channel to remove from prediction logs.',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
    ],
    dm_permission: false,
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: true,
    devOnly: true,
};
async function run({ interaction }) {
    try {
        let guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration) {
            guildConfiguration = new GuildConfiguration_1.default({
                guildId: interaction.guildId,
            });
        }
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        if (subcommand === 'add-actions') {
            const channel = options.getChannel('channel', true);
            if (guildConfiguration.predictionChannelIds.actions === channel.id) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Prediction Channel Setup - Add Actions', `Channel ${channel} is already set for prediction actions.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            guildConfiguration.predictionChannelIds.actions = channel.id;
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Prediction Channel Setup - Add Actions', `Channel ${channel} has been successfully set for prediction actions.`),
                ],
            });
        }
        if (subcommand === 'remove-actions') {
            const channelId = options.getString('channel-id', true);
            if (guildConfiguration.predictionChannelIds.actions !== channelId) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Prediction Channel Setup - Remove Actions', `Channel with ID ${channelId} is not set for prediction actions.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            guildConfiguration.predictionChannelIds.actions = '';
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Prediction Channel Setup - Remove Actions', `Channel with ID ${channelId} has been removed from prediction actions.`),
                ],
            });
        }
        if (subcommand === 'add-logs') {
            const channel = options.getChannel('channel', true);
            if (guildConfiguration.predictionChannelIds.logs === channel.id) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Prediction Channel Setup - Add Logs', `Channel ${channel} is already set for prediction logs.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            guildConfiguration.predictionChannelIds.logs = channel.id;
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Prediction Channel Setup - Add Logs', `Channel ${channel} has been successfully set for prediction logs.`),
                ],
            });
        }
        if (subcommand === 'remove-logs') {
            const channelId = options.getString('channel-id', true);
            if (guildConfiguration.predictionChannelIds.logs !== channelId) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Prediction Channel Setup - Remove Logs', `Channel with ID ${channelId} is not set for prediction logs.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            guildConfiguration.predictionChannelIds.logs = '';
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Prediction Channel Setup - Remove Logs', `Channel with ID ${channelId} has been removed from prediction logs.`),
                ],
            });
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
