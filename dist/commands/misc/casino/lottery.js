"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../utils/createEmbed");
const utils_1 = require("../../../utils/utils");
const casinoHelpers_1 = require("../../../utils/casinoHelpers");
exports.data = {
    name: 'lottery',
    description: 'Play the lottery! Pick 5 numbers and see if you win.',
    options: [
        {
            name: 'bet',
            description: 'Your bet amount (e.g., 100, 1k, 5k).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'numbers',
            description: 'Pick 4 numbers between 1-50, separated by commas (e.g., 3, 14, 25, 38).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'entries',
            description: 'Number of entries.',
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
    deleted: false,
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
        const entries = interaction.options.getInteger('entries') || 1;
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
        if (configReply.casinoSettings.lottery.maxBet > 0 &&
            parsedBetAmount > configReply.casinoSettings.lottery.maxBet) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Above Maximum Bet', `The maximum bet is **$${(0, utils_1.formatNumberToReadableString)(configReply.casinoSettings.lottery.maxBet)}**.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (configReply.casinoSettings.lottery.minBet > 0 &&
            parsedBetAmount < configReply.casinoSettings.lottery.minBet) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Below Minimum Bet', `The minimum bet is **$${(0, utils_1.formatNumberToReadableString)(configReply.casinoSettings.lottery.minBet)}**.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const totalBet = parsedBetAmount * entries;
        if (user.balance < totalBet) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Insufficient Funds', `You don't have enough money to place this bet for ${entries} entries (you need **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**).\nYour current balance is **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const numbersInput = interaction.options.getString('numbers', true);
        const userNumbers = numbersInput.split(',').map((n) => parseFloat(n.trim()));
        if (userNumbers.length !== 4 ||
            userNumbers.some((n) => !Number.isInteger(n) ||
                n < 1 ||
                n > 50 ||
                new Set(userNumbers).size !== 4)) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Numbers', 'Pick 5 unique whole numbers between 1-50, separated by commas (e.g., 3, 14, 25, 38).'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        let totalWinnings = 0;
        let results = [];
        for (let i = 0; i < entries; i++) {
            const lotteryNumbers = (0, casinoHelpers_1.drawLottery)();
            const resultString = `${lotteryNumbers
                .map((n) => n.toString().padStart(2, '0'))
                .join(', ')}`;
            const matchedNumbers = userNumbers.filter((n) => lotteryNumbers.includes(n)).length;
            const winnings = parsedBetAmount *
                configReply.casinoSettings.lottery.winMultipliers[matchedNumbers];
            results.push(`**${resultString}** | ${matchedNumbers >= 2
                ? `🎉 **${matchedNumbers}**`
                : `❌ **${matchedNumbers}**`} | ${matchedNumbers >= 2
                ? `**+$${(0, utils_1.formatNumberToReadableString)(winnings)}**`
                : `**-$${readableBetAmount}**`}`);
            totalWinnings += winnings - parsedBetAmount;
        }
        user.balance += totalWinnings;
        await user.save();
        const isWin = totalWinnings > 0;
        const isLoss = totalWinnings < 0;
        return interaction.reply({
            embeds: [
                (0, createEmbed_1.createBetEmbed)(isWin
                    ? '🎟️ **Win!** 🎉'
                    : isLoss
                        ? '🎟️ **Better Luck Next Time...** ❌'
                        : '🎟️ **Not Bad...** 👀', isWin ? 'Green' : isLoss ? 'Red' : 'Yellow', `💵 Total Bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n\n` +
                    `Your numbers: **${userNumbers
                        .map((n) => n.toString().padStart(2, '0'))
                        .join(', ')}**\n\n` +
                    `🎟️ **Draw Results:**\n${results.join('\n')}\n\n` +
                    `💰 Total: ${isWin ? '🟢' : isLoss ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(totalWinnings)}**\n` +
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
