"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const utils_1 = require("../../../utils/utils");
exports.data = {
    name: 'money-manager',
    description: 'Create an embed for manage balance.',
    options: [
        {
            name: 'give-balance',
            description: 'Create an embed for giving money.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'amount',
                    description: 'The amount of money you want to give.',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            name: 'reset-balance',
            description: 'Create an embed for resetting money.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
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
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        if (subcommand === 'give-balance') {
            const amount = interaction.options.getString('amount', true);
            const parsedAmount = (0, utils_1.parseReadableStringToNumber)(amount);
            const readableAmount = (0, utils_1.formatNumberToReadableString)(parsedAmount);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('Money Generator')
                .setColor(discord_js_1.Colors.DarkGreen)
                .setDescription(`Click to add **$${readableAmount}** to your account.\n` +
                'You can use this money to try **CASINO** games.')
                .setTimestamp();
            const giveButton = new discord_js_1.ButtonBuilder()
                .setLabel(`💸 Claim Money`)
                .setStyle(discord_js_1.ButtonStyle.Success)
                .setCustomId(`give-money.${parsedAmount}`);
            const row = new discord_js_1.ActionRowBuilder().addComponents(giveButton);
            return interaction.reply({
                embeds: [embed],
                components: [row],
            });
        }
        if (subcommand === 'reset-balance') {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('Money Reset')
                .setColor(discord_js_1.Colors.DarkRed)
                .setDescription('Click to reset your account balance.')
                .setTimestamp();
            const resetButton = new discord_js_1.ButtonBuilder()
                .setLabel(`🔄 Reset Money`)
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setCustomId(`reset-money`);
            const row = new discord_js_1.ActionRowBuilder().addComponents(resetButton);
            return interaction.reply({
                embeds: [embed],
                components: [row],
            });
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
