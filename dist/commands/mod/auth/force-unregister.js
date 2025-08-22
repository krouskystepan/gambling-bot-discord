"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const utils_1 = require("../../../utils/utils");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'force-unregister',
    description: 'Unregister a user (delete from DB).',
    options: [
        {
            name: 'user-id',
            description: 'The ID of the user you want to unregister.',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
    ],
    dm_permission: false,
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false,
};
async function run({ interaction, client }) {
    try {
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
        const userId = interaction.options.getString('user-id', true);
        const registeredUser = await (0, utils_1.checkUserRegistration)(userId, guildConfiguration.guildId);
        if (!registeredUser) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('ATM Error - Not Registered.', 'User is not registered yet.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const logChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.logs);
        logChannel
            .send({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setTitle('ATM - User Unregistered')
                    .setDescription(`Manager <@${interaction.user.id}> has unregistered the user with ID ${userId}.`)
                    .setColor('NotQuiteBlack'),
            ],
        })
            .catch(console.error);
        await registeredUser.deleteOne();
        return interaction.reply({
            embeds: [
                (0, createEmbed_1.createSuccessEmbed)('ATM Success - Unregistered', `The user with ID ${userId} has been successfully unregistered.`),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
