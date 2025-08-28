"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'setup-prediction',
    description: 'Manage channels for predictions.',
    options: [
        {
            name: 'add',
            description: 'Set a channel for using predictions.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel you want to set up for using predictions.',
                    type: discord_js_1.ApplicationCommandOptionType.Channel,
                    channel_types: [discord_js_1.ChannelType.GuildText],
                    required: true,
                },
            ],
        },
        {
            name: 'remove',
            description: 'Remove a channel for using predictions by ID.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel-id',
                    description: 'The ID of the channel you want to remove from using predictions.',
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
    deleted: false,
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
        if (subcommand === 'add') {
            const channel = interaction.options.getChannel('channel', true);
            if (guildConfiguration.predictionChannelIds.includes(channel.id)) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Prediction Channel Setup - Add', `Channel ${channel} is already configured for using predictions.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            guildConfiguration.predictionChannelIds.push(channel.id);
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Prediction Channel Setup - Add', `Channel ${channel} has been successfully set for using predictions.`),
                ],
            });
        }
        if (subcommand === 'remove') {
            const channelId = options.getString('channel-id', true);
            if (!guildConfiguration.adminChannelIds.includes(channelId)) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Admin Channel Setup - Remove', `Channel with ID ${channelId} is not set for predictions.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            guildConfiguration.predictionChannelIds =
                guildConfiguration.predictionChannelIds.filter((id) => id !== channelId);
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Admin Channel Setup - Remove', `Channel with ID ${channelId} has been successfully removed from using predictions.`),
                ],
            });
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
