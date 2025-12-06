"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../utils/createEmbed");
const utils_1 = require("../../../utils/utils");
const casinoHelpers_1 = require("../../../utils/casinoHelpers");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const gambling_bot_shared_1 = require("@krouskystepan/gambling-bot-shared");
exports.data = {
    name: 'simulate-goldenjackpot',
    description: 'Simulate X goldenjackpot entries. WARNING: May take a long time!',
    options: [
        {
            name: 'entries',
            description: 'Number of entries you want to simulate.',
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
    ],
    dm_permission: false,
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false,
    devOnly: true,
};
async function run({ interaction }) {
    try {
        const config = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        const settings = config?.casinoSettings;
        if (!settings)
            return;
        await interaction.deferReply();
        let totalBet = 0;
        let totalWinnings = 0;
        let wins = 0;
        let losses = 0;
        let currentWinningStreak = 0;
        let biggestWinningStreak = 0;
        let currentLosingStreak = 0;
        let biggestLosingStreak = 0;
        const entries = (0, utils_1.parseReadableStringToNumber)(interaction.options.getString('entries', true));
        if (entries > gambling_bot_shared_1.GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES) {
            return interaction.editReply({
                content: `The maximum number of entries is **${(0, utils_1.formatNumberToReadableString)(gambling_bot_shared_1.GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES)}**.`,
            });
        }
        const bet = (0, utils_1.parseReadableStringToNumber)(interaction.options.getString('bet', true));
        const winsLosses = interaction.options.getBoolean('wins-losses-count');
        const winLossesSeries = interaction.options.getBoolean('win-losses-series');
        const details = interaction.options.getBoolean('details');
        await interaction.editReply(`Simulating **${(0, utils_1.formatNumberToReadableString)(entries)}** entries with a bet of **$${(0, utils_1.formatNumberToReadableString)(bet)}**. Please wait...`);
        const startTime = performance.now();
        for (let i = 1; i <= entries; i++) {
            totalBet += bet;
            const jackpotNumber = (0, casinoHelpers_1.drawGoldenJackpot)(settings.goldenJackpot);
            let winnings = 0;
            if (jackpotNumber === 1) {
                winnings = bet * settings.goldenJackpot.winMultiplier;
                wins++;
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
        const winDetails = `**1** in **${(0, utils_1.formatNumberWithSpaces)(settings.goldenJackpot.oneInChance)}**`;
        const winLossesDetails = `🎉 Wins: **${(0, utils_1.formatNumberWithSpaces)(wins)}**\n` +
            `❌ Losses: **${(0, utils_1.formatNumberWithSpaces)(losses)}**`;
        const winLossesSeriesDetails = `🔥 Longest winning streak: **${biggestWinningStreak}**\n` +
            `💀 Longest losing streak: **${biggestLosingStreak}**`;
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);
        const embed = (0, createEmbed_1.createBetEmbed)(`🤑 GoldenJackpot Simulation - ${(0, utils_1.formatNumberToReadableString)(entries)} entries`, profitOrLoss >= 0 ? 'Green' : 'Red', `Total bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n` +
            `Total: **$${(0, utils_1.formatNumberToReadableString)(totalWinnings)}**\n` +
            `Profit/Loss: **$${(0, utils_1.formatNumberToReadableString)(profitOrLoss)}**\n` +
            `Profit/Loss Percentage: **${profitOrLossPercentage.toFixed(2)}%**\n` +
            `📊 RTP: **${rtp.toFixed(2)}%**\n\n` +
            (winsLosses ? `${winLossesDetails}\n\n` : '') +
            (winLossesSeries ? `${winLossesSeriesDetails}\n\n` : '') +
            (details ? `Details: ${winDetails}\n\n` : '') +
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
