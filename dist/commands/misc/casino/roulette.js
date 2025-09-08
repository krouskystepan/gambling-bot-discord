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
            description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
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
        {
            name: 'spins',
            description: 'Number of spins.',
            type: discord_js_1.ApplicationCommandOptionType.Integer,
            required: false,
            choices: Array.from({ length: 20 }, (_, i) => ({
                name: (i + 1).toString(),
                value: i + 1,
            })),
        },
        {
            name: 'show-balance',
            description: 'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
            type: discord_js_1.ApplicationCommandOptionType.Boolean,
            required: false,
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
        if (!user) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'You are not registered yet.\nUse the `/register` command to register.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const configReply = await (0, utils_1.checkChannelConfiguration)(interaction, 'casinoChannelIds', {
            notSet: 'This server has not been configured for betting commands yet.\nSet it up using web dashboard.',
            notAllowed: `This channel is not configured for betting commands.\nTry one of these channels:`,
        });
        if (!configReply)
            return;
        const spins = interaction.options.getInteger('spins') || 1;
        const betType = interaction.options.getString('type', true);
        const betValue = interaction.options.getString('value', true);
        const betAmount = interaction.options.getString('bet', true);
        const parsedBetAmount = (0, utils_1.parseReadableStringToNumber)(betAmount);
        const readableBetAmount = (0, utils_1.formatNumberToReadableString)(parsedBetAmount);
        const showBalance = interaction.options.getBoolean('show-balance');
        if (isNaN(parsedBetAmount)) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Not a number', 'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (parsedBetAmount <= 0) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Non-positive number', 'The number you provided must be greater than 0.\nPlease enter a positive value.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const totalBet = parsedBetAmount * spins;
        if (user.balance < totalBet) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Insufficient Funds', `You don't have enough money to place this bet for ${spins} spins (you need **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**).\nYour current balance is **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        // ✅ validate bet value depending on betType
        switch (betType) {
            case 'number':
                if (!rouletteUtils_1.AMERICAN_NUMBERS.includes(betValue))
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Number', 'Choose a valid number: 0, 00, or 1–36'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
            case 'color':
                if (!['red', 'black'].includes(betValue.toLowerCase()))
                    return interaction.reply({
                        embeds: [(0, createEmbed_1.createInfoEmbed)('Invalid Color', 'Choose red or black')],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
            case 'parity':
                if (!['even', 'odd'].includes(betValue.toLowerCase()))
                    return interaction.reply({
                        embeds: [(0, createEmbed_1.createInfoEmbed)('Invalid Parity', 'Choose even or odd')],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
            case 'range':
                if (!['low', 'high'].includes(betValue.toLowerCase()))
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Range', 'Choose low (1–18) or high (19–36)'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
            case 'dozen':
                if (!['1', '2', '3'].includes(betValue))
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Dozen', 'Choose 1 (1–12), 2 (13–24), or 3 (25–36)'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
            case 'column':
                if (!['1', '2', '3'].includes(betValue))
                    return interaction.reply({
                        embeds: [(0, createEmbed_1.createInfoEmbed)('Invalid Column', 'Choose 1, 2, or 3')],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                break;
        }
        let totalNet = 0;
        let results = [];
        for (let i = 0; i < spins; i++) {
            const result = (0, casinoHelpers_1.spinRouletteWheel)();
            let displayResult = result;
            if (/^\d+$/.test(result)) {
                const num = parseInt(result, 10);
                displayResult = num.toString().padStart(2, '0');
            }
            const color = (0, rouletteUtils_1.getRouletteColor)(result);
            const rouletteBet = { type: betType, value: betValue };
            const winnings = (0, rouletteUtils_1.calculateRouletteWin)(rouletteBet, result, parsedBetAmount);
            const net = winnings - parsedBetAmount;
            results.push(`**${color} ${displayResult}** | ${net > 0 ? '🎉' : net < 0 ? '❌' : '—'} | ${net > 0
                ? `**+$${(0, utils_1.formatNumberToReadableString)(net)}**`
                : net < 0
                    ? `**-$${readableBetAmount}**`
                    : `**$0**`}`);
            totalNet += net;
        }
        user.balance += totalNet;
        await user.save();
        const isWin = totalNet > 0;
        const isLoss = totalNet < 0;
        return interaction.reply({
            embeds: [
                (0, createEmbed_1.createBetEmbed)(isWin
                    ? '🎰 **Win!** 🎉'
                    : isLoss
                        ? '🎰 **Better Luck Next Time...** ❌'
                        : '🎰 **Not Bad...** 👀', isWin ? 'Green' : isLoss ? 'Red' : 'Yellow', `💵 Total Bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n\n` +
                    `🎲 **Spin Results:**\n${results.join('\n')}\n\n` +
                    `💰 Total: ${isWin ? '🟢' : isLoss ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(totalNet)}**\n` +
                    (showBalance
                        ? `🏦 Balance: **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**`
                        : '')),
            ],
        });
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
