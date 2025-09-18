"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const User_1 = require("../../../models/User");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'register',
    description: 'Register yourself in the system.',
    dm_permission: false,
};
exports.options = {
    deleted: false,
};
async function run({ interaction, client }) {
    try {
        const guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration?.atmChannelIds?.logs ||
            !guildConfiguration?.atmChannelIds?.actions) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not Configured', 'ATM logs or actions are not configured yet.\nPlease contact an administrator to complete the setup.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (guildConfiguration.atmChannelIds.actions !== interaction.channelId) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Incorrect Channel', `This command can only be used in <#${guildConfiguration.atmChannelIds.actions}>.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const result = await User_1.default.findOneAndUpdate({
            userId: interaction.user.id,
            guildId: interaction.guildId,
        }, { $setOnInsert: { balance: 0, lockedBalance: 0 } }, { new: true, upsert: true });
        const wasAlreadyRegistered = result &&
            result.createdAt &&
            result.updatedAt &&
            result.createdAt < result.updatedAt;
        if (wasAlreadyRegistered) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('ATM Error - Registered', 'You are already registered in the system.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const logChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.logs);
        logChannel
            .send({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setTitle('ATM - User Registration')
                    .setDescription(`User <@${interaction.user.id}> has successfully registered in the system.`)
                    .setColor('White'),
            ],
        })
            .catch(console.error);
        return interaction.reply({
            embeds: [
                (0, createEmbed_1.createSuccessEmbed)('ATM Success - Registered', 'You have been successfully registered in the system.'),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
