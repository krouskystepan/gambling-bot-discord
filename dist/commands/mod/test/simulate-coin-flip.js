import { COINFLIP_MAX_SIMULATE_FLIPS } from 'gambling-bot-shared';
import { ApplicationCommandOptionType } from 'discord.js';
import { handleUnexpectedInteractionError } from '@/errors';
import { getGuildConfigByGuildId } from '@/services';
import { flipCoin } from '@/utils/casino/rng';
import { formatNumberToReadableString, formatNumberWithSpaces, parseReadableStringToNumber } from '@/utils/common/utils';
import { createBetEmbed } from '@/utils/discord/createEmbed';
export const data = {
    name: 'simulate-coin-flip',
    description: 'Simulate X coin flips. WARNING: May take a long time!',
    options: [
        {
            name: 'flips',
            description: 'Number of flips you want to simulate.',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'bet',
            description: 'Enter a bet (e.g. 1000, 2k, 4.5k).',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'wins-losses-count',
            description: 'Displays the count of wins and losses.',
            type: ApplicationCommandOptionType.Boolean,
            required: false
        },
        {
            name: 'win-losses-series',
            description: 'Displays the longest winning and losing streak.',
            type: ApplicationCommandOptionType.Boolean,
            required: false
        },
        {
            name: 'multipliers',
            description: 'Displays multipliers.',
            type: ApplicationCommandOptionType.Boolean,
            required: false
        }
    ],
    dm_permission: false
};
export const options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false,
    devOnly: true
};
export async function run({ interaction }) {
    try {
        const config = await getGuildConfigByGuildId({
            guildId: interaction.guildId
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
        const flips = parseReadableStringToNumber(interaction.options.getString('flips', true));
        if (flips > COINFLIP_MAX_SIMULATE_FLIPS) {
            return interaction.editReply({
                content: `The maximum number of flips is **${formatNumberToReadableString(COINFLIP_MAX_SIMULATE_FLIPS)}**.`
            });
        }
        const bet = parseReadableStringToNumber(interaction.options.getString('bet', true));
        const winsLosses = interaction.options.getBoolean('wins-losses-count');
        const winLossesSeries = interaction.options.getBoolean('win-losses-series');
        const multipliers = interaction.options.getBoolean('multipliers');
        await interaction.editReply(`Simulating **${formatNumberToReadableString(flips)}** coin flips with a bet of **$${formatNumberToReadableString(bet)}**. Please wait...`);
        const startTime = performance.now();
        for (let i = 1; i <= flips; i++) {
            totalBet += bet;
            const coinFlip = flipCoin();
            let winnings = 0;
            if (coinFlip === 'heads') {
                winnings = bet * settings.coinflip.winMultiplier;
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
        const winLossesDetails = `🎉 Wins: **${formatNumberWithSpaces(wins)}**\n` +
            `❌ Losses: **${formatNumberWithSpaces(losses)}**`;
        const winLossesSeriesDetails = `🔥 Longest winning streak: **${biggestWinningStreak}**\n` +
            `💀 Longest losing streak: **${biggestLosingStreak}**`;
        const multipliersDetails = `**${settings?.coinflip.winMultiplier}x**`;
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);
        const embed = createBetEmbed(`🪙 Coin Flip Simulation - ${formatNumberToReadableString(flips)} flips`, profitOrLoss >= 0 ? 'Green' : 'Red', `Total bet: **$${formatNumberToReadableString(totalBet)}**\n` +
            `Total: **$${formatNumberToReadableString(totalWinnings)}**\n` +
            `Profit/Loss: **$${formatNumberToReadableString(profitOrLoss)}**\n` +
            `Profit/Loss Percentage: **${profitOrLossPercentage.toFixed(2)}%**\n` +
            `📊 RTP: **${rtp.toFixed(2)}%**\n\n` +
            (winsLosses ? `${winLossesDetails}\n\n` : '') +
            (winLossesSeries ? `${winLossesSeriesDetails}\n\n` : '') +
            (multipliers ? `Multiplier: ${multipliersDetails}\n\n` : '') +
            `All flips took: **${totalTime}s**`);
        await interaction.editReply({
            content: `Simulation completed.`,
            embeds: [embed]
        });
    }
    catch (error) {
        await handleUnexpectedInteractionError(interaction, error);
    }
}
