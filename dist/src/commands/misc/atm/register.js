"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const utils_1 = require("../../../utils/utils");
const discord_js_1 = require("discord.js");
const User_1 = require("../../../models/User");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'register',
    description: 'Register yourself in the system.',
    contexts: [0],
};
exports.options = {
    deleted: false,
};
async function run({ interaction, client }) {
    try {
        const user = await (0, utils_1.checkUserRegistration)(interaction.user.id, interaction.guildId);
        if (user) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('ATM Error - Registered.', 'You are already registered in the system.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration?.atmChannelIds.logs) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Logs Not Set Up', 'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (!guildConfiguration?.atmChannelIds.actions) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Actions Not Configured', 'This ATM command has not been set up yet.\nPlease contact an administrator to complete the setup.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (guildConfiguration?.atmChannelIds.actions !== interaction.channelId) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Incorrect Channel', `This command can only be used in <#${guildConfiguration.atmChannelIds.actions}>.\nPlease use the correct channel to proceed.`),
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
        const newUser = new User_1.default({
            userId: interaction.user.id,
            guildId: interaction.guildId,
        });
        await newUser.save();
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
