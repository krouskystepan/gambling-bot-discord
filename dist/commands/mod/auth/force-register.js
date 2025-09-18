"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const User_1 = require("../../../models/User");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'force-register',
    description: 'Force register a user.',
    options: [
        {
            name: 'user',
            description: 'The user you want to register.',
            type: discord_js_1.ApplicationCommandOptionType.User,
            required: true,
        },
    ],
    dm_permission: false,
};
exports.options = {
    deleted: true,
};
async function run({ interaction, client }) {
    try {
        const guildConfig = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfig?.atmChannelIds.logs) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Logs Not Set Up', 'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const user = interaction.options.getUser('user', true);
        const newUser = await User_1.default.findOneAndUpdate({ userId: user.id, guildId: interaction.guildId }, { $setOnInsert: { balance: 0, lockedBalance: 0 } }, { new: true, upsert: true });
        if (!newUser.isNew) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('ATM Error - Already Registered', 'User is already registered in the system.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const logChannel = client.channels.cache.get(guildConfig.atmChannelIds.logs);
        logChannel
            ?.send({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setTitle('ATM - User Registered')
                    .setDescription(`Manager <@${interaction.user.id}> has successfully registered <@${user.id}>.`)
                    .setColor('Grey'),
            ],
        })
            .catch(console.error);
        return interaction.reply({
            embeds: [
                (0, createEmbed_1.createSuccessEmbed)('ATM Success - Registered', 'The user has been successfully registered in the system.'),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        console.error('Error running /force-register:', error);
    }
}
