"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const casinoConfig_1 = require("../../../utils/casinoConfig");
const createEmbed_1 = require("../../../utils/createEmbed");
const casinoHelpers_1 = require("../../../utils/casinoHelpers");
const utils_1 = require("../../../utils/utils");
exports.data = {
    name: 'simulate-lottery',
    description: 'Simulate X lottery entries. WARNING: May take a long time!',
    options: [
        {
            name: 'entries',
            description: 'Number of entries.',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'bet',
            description: 'Enter a bet (e.g. 1000, 2k, 4.5k).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'details',
            description: 'Displays win details.',
            type: discord_js_1.ApplicationCommandOptionType.Boolean,
            required: false,
        },
        {
            name: 'wins-losses-count',
            description: 'Displays the count of wins and losses.',
            type: discord_js_1.ApplicationCommandOptionType.Boolean,
            required: false,
        },
        {
            name: 'win-losses-series',
            description: 'Displays the longest winning and losing streak.',
            type: discord_js_1.ApplicationCommandOptionType.Boolean,
            required: false,
        },
        {
            name: 'multipliers',
            description: 'Displays multipliers.',
            type: discord_js_1.ApplicationCommandOptionType.Boolean,
            required: false,
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
        await interaction.deferReply();
        let totalBet = 0;
        let totalWinnings = 0;
        let wins = 0;
        let losses = 0;
        let winCounts = {};
        let currentWinningStreak = 0;
        let biggestWinningStreak = 0;
        let currentLosingStreak = 0;
        let biggestLosingStreak = 0;
        const entries = (0, utils_1.parseReadableStringToNumber)(interaction.options.getString('entries', true));
        if (entries > casinoConfig_1.MAX_SIMULATE_LOTTERY) {
            return interaction.editReply({
                content: `The maximum number of entries is ${(0, utils_1.formatNumberToReadableString)(casinoConfig_1.MAX_SIMULATE_LOTTERY)}.`,
            });
        }
        const bet = (0, utils_1.parseReadableStringToNumber)(interaction.options.getString('bet', true));
        const details = interaction.options.getBoolean('details');
        const winsLosses = interaction.options.getBoolean('wins-losses-count');
        const winLossesSeries = interaction.options.getBoolean('win-losses-series');
        const multipliers = interaction.options.getBoolean('multipliers');
        await interaction.editReply(`Simulating **${(0, utils_1.formatNumberToReadableString)(entries)}** entries with a bet of **$${(0, utils_1.formatNumberToReadableString)(bet)}**. Please wait...`);
        const startTime = performance.now();
        const userNumbers = [1, 2, 3, 4, 5];
        for (let i = 1; i <= entries; i++) {
            totalBet += bet;
            const lotteryNumbers = (0, casinoHelpers_1.drawLottery)();
            let winnings = 0;
            const matchedNumbers = userNumbers.filter((n) => lotteryNumbers.includes(n)).length;
            winnings = bet * (0, casinoConfig_1.getLotteryMultiplier)(matchedNumbers);
            if ((0, casinoConfig_1.getLotteryMultiplier)(matchedNumbers)) {
                wins++;
                winCounts[matchedNumbers] = (winCounts[matchedNumbers] || 0) + 1;
                currentLosingStreak = 0;
                currentWinningStreak++;
                if (currentWinningStreak > biggestWinningStreak) {
                    biggestWinningStreak = currentWinningStreak;
                }
            }
            else {
                losses++;
                currentWinningStreak = 0;
                currentLosingStreak++;
                if (currentLosingStreak > biggestLosingStreak) {
                    biggestLosingStreak = currentLosingStreak;
                }
            }
            totalWinnings += winnings;
        }
        const endTime = performance.now();
        await interaction.editReply(`Simulation complete. Generating results...`);
        const profitOrLoss = totalWinnings - totalBet;
        const profitOrLossPercentage = (profitOrLoss / totalBet) * 100;
        const rtp = (totalWinnings / totalBet) * 100;
        const winLossesDetails = `🎉 Wins: **${(0, utils_1.formatNumberWithSpaces)(wins)}**\n` +
            `❌ Losses: **${(0, utils_1.formatNumberWithSpaces)(losses)}**`;
        const winLossesSeriesDetails = `🔥 Longest winning streak: **${biggestWinningStreak}**\n` +
            `💀 Longest losing streak: **${biggestLosingStreak}**`;
        const winDetails = Object.entries(winCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([symbol, count]) => `${symbol}: **${(0, utils_1.formatNumberWithSpaces)(count)}**x`)
            .join('\n');
        const multipliersDetails = Array.from({ length: 6 }, (_, i) => `${i}: **${(0, casinoConfig_1.getLotteryMultiplier)(i)}**x`).join('\n');
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);
        const embed = (0, createEmbed_1.createBetEmbed)(`🎟️ Lottery Simulation - ${(0, utils_1.formatNumberToReadableString)(entries)} entries`, profitOrLoss >= 0 ? 'Green' : 'Red', `Total bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n` +
            `Total winnings: **$${(0, utils_1.formatNumberToReadableString)(totalWinnings)}**\n` +
            `Profit/Loss: **$${(0, utils_1.formatNumberToReadableString)(profitOrLoss)}**\n` +
            `Profit/Loss Percentage: **${profitOrLossPercentage.toFixed(2)}%**\n` +
            `📊 RTP: **${rtp.toFixed(2)}%**\n\n` +
            (winsLosses ? `${winLossesDetails}\n\n` : '') +
            (winLossesSeries ? `${winLossesSeriesDetails}\n\n` : '') +
            (details ? `Win details:\n${winDetails || 'No wins'}\n\n` : '') +
            (multipliers ? `Multipliers:\n${multipliersDetails}\n\n` : '') +
            `All entries took: **${totalTime}s**`);
        await interaction.editReply({
            content: `Simulation completed.`,
            embeds: [embed],
        });
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
