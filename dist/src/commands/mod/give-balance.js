"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const User_1 = require("../../models/User");
const utils_1 = require("../../utils/utils");
exports.data = {
    name: 'give-balance',
    description: 'Create an embed for giving money.',
    options: [
        {
            name: 'amount',
            description: 'The amount of money you want to give.',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
    ],
    contexts: [0],
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false,
};
async function run({ interaction }) {
    try {
        const amount = interaction.options.getString('amount', true);
        const parsedAmount = (0, utils_1.parseReadableStringToNumber)(amount);
        User_1.default.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('Money Generator')
            .setColor(discord_js_1.Colors.Yellow)
            .setDescription(`Click to add **$${amount}** to your account.\n` +
            'You can use this money to try **CASINO** games.')
            .setTimestamp();
        const betButtons = new discord_js_1.ButtonBuilder()
            .setLabel(`💸 Claim Money`)
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setCustomId(`give-money.${parsedAmount}`);
        const row = new discord_js_1.ActionRowBuilder().addComponents(betButtons);
        return interaction.reply({
            embeds: [embed],
            components: [row],
        });
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
