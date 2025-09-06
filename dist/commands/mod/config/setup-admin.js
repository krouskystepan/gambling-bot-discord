"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'setup-admin',
    description: 'Manage the admin channels.',
    options: [
        {
            name: 'add',
            description: 'Set a channel for using admin commands.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel you want to set for admin commands.',
                    type: discord_js_1.ApplicationCommandOptionType.Channel,
                    channel_types: [discord_js_1.ChannelType.GuildText],
                    required: true,
                },
            ],
        },
        {
            name: 'remove',
            description: 'Remove a channel from admin commands using its ID.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel-id',
                    description: 'The ID of the channel you want to remove from admin commands.',
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
            if (guildConfiguration.adminChannelIds.includes(channel.id)) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Admin Channel Setup - Add', `Channel ${channel} is already configured for admin commands.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            guildConfiguration.adminChannelIds.push(channel.id);
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Admin Channel Setup - Add', `Channel ${channel} has been successfully added for admin commands.`),
                ],
            });
        }
        if (subcommand === 'remove') {
            const channelId = options.getString('channel-id', true);
            if (!guildConfiguration.adminChannelIds.includes(channelId)) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Admin Channel Setup - Remove', `Channel with ID ${channelId} is not set for admin commands.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            guildConfiguration.adminChannelIds =
                guildConfiguration.adminChannelIds.filter((id) => id !== channelId);
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Admin Channel Setup - Remove', `Channel with ID ${channelId} has been successfully removed from admin commands.`),
                ],
            });
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
