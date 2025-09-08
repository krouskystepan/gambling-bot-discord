"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../utils/createEmbed");
const utils_1 = require("../../../utils/utils");
const casinoHelpers_1 = require("../../../utils/casinoHelpers");
const rouletteUtils_1 = require("../../../utils/rouletteUtils");
exports.data = {
    name: 'roulette',
    description: 'Play American roulette!',
    options: [
        {
            name: 'bet',
            description: 'Your bet amount (e.g., 100, 1k, 5k).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'type',
            description: 'Bet type: number, color, parity, range, dozen, column',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: 'Number', value: 'number' },
                { name: 'Color', value: 'color' },
                { name: 'Parity', value: 'parity' },
                { name: 'Range', value: 'range' },
                { name: 'Dozen', value: 'dozen' },
                { name: 'Column', value: 'column' },
            ],
        },
        {
            name: 'value',
            description: 'Your bet value (number, red/black, even/odd, etc.)',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
    ],
    dm_permission: false,
};
exports.options = {
    deleted: true,
};
async function run({ interaction }) {
    try {
        const user = await (0, utils_1.checkUserRegistration)(interaction.user.id, interaction.guildId);
        if (!user)
            return interaction.reply({
                embeds: [(0, createEmbed_1.createErrorEmbed)('Not Registered', 'Use `/register` first.')],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        const configReply = await (0, utils_1.checkChannelConfiguration)(interaction, 'casinoChannelIds', {
            notSet: 'Casino not configured yet.',
            notAllowed: 'This channel is not allowed.',
        });
        if (!configReply)
            return;
        const betAmountStr = interaction.options.getString('bet', true);
        const betAmount = (0, utils_1.parseReadableStringToNumber)(betAmountStr);
        if (isNaN(betAmount)) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Not a number', 'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (betAmount <= 0) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Non-positive number', 'The number you provided must be greater than 0.\nPlease enter a positive value.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (betAmount > user.balance)
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Insufficient Funds', `Your balance is $${(0, utils_1.formatNumberToReadableString)(user.balance)}, cannot bet $${(0, utils_1.formatNumberToReadableString)(betAmount)}`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        const betType = interaction.options.getString('type', true);
        const betValue = interaction.options.getString('value', true);
        switch (betType) {
            case 'number':
                if (!rouletteUtils_1.AMERICAN_NUMBERS.includes(betValue))
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Number', 'Choose a valid number: 0, 00, or 1–36'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
            case 'color':
                if (!['red', 'black'].includes(betValue.toLowerCase()))
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Color', 'Choose red or black'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
            case 'parity':
                if (!['even', 'odd'].includes(betValue.toLowerCase()))
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Parity', 'Choose even or odd'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
            case 'range':
                if (!['low', 'high'].includes(betValue.toLowerCase()))
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Range', 'Choose low (1–18) or high (19–36)'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
            case 'dozen':
                if (!['1', '2', '3'].includes(betValue))
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Dozen', 'Choose 1 (1–12), 2 (13–24), or 3 (25–36)'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
            case 'column':
                if (!['1', '2', '3'].includes(betValue))
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Column', 'Choose 1, 2, or 3'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
        }
        const rouletteBet = { type: betType, value: betValue };
        const result = (0, casinoHelpers_1.spinRouletteWheel)();
        const winnings = (0, rouletteUtils_1.calculateRouletteWin)(rouletteBet, result, betAmount);
        user.balance += winnings - betAmount;
        await user.save();
        const isWin = winnings > 0;
        const isLoss = winnings < 0;
        const showBalance = true;
        return interaction.reply({
            embeds: [
                (0, createEmbed_1.createBetEmbed)(isWin
                    ? '🔄 **Win!** 🎉'
                    : isLoss
                        ? '🔄 **Better Luck Next Time...** ❌'
                        : '🔄 **Not Bad...** 👀', isWin ? 'Green' : isLoss ? 'Red' : 'Yellow', `💵 Total Bet: **$${(0, utils_1.formatNumberToReadableString)(betAmount)}**\n\n` +
                    `🔄 Bet Type: **${betType}** | Value: **${betValue}**\n` +
                    `🟢 Result: **${result}**\n` +
                    `💰 Total: ${isWin ? '🟢' : isLoss ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(winnings)}**\n` +
                    (showBalance
                        ? `🏦 Balance: **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**`
                        : '')),
            ],
        });
    }
    catch (err) {
        console.error('Roulette command error:', err);
    }
}
