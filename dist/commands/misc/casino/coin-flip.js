import { ApplicationCommandOptionType } from 'discord.js';
import { handleUnexpectedInteractionError } from '@/errors';
import { checkCasinoChannels, checkUserRegistration, createTransaction, updateUserBalance } from '@/services';
import { flipCoin } from '@/utils/casino/rng';
import { checkValidBet, formatNumberToReadableString, generateBetId, parseReadableStringToNumber } from '@/utils/common/utils';
import { createBetEmbed } from '@/utils/discord/createEmbed';
import { coinEmojis, flipCoinEmote } from '@/utils/discord/customEmotes';
export const data = {
    name: 'coin-flip',
    description: 'Flip a coin!',
    options: [
        {
            name: 'bet',
            description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'side',
            description: 'Choose the coin side.',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: 'Heads', value: 'heads' },
                { name: 'Tails', value: 'tails' }
            ]
        },
        {
            name: 'flips',
            description: 'Number of flips.',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            choices: Array.from({ length: 10 }, (_, i) => ({
                name: (i + 1).toString(),
                value: i + 1
            }))
        },
        {
            name: 'show-balance',
            description: 'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
            type: ApplicationCommandOptionType.Boolean,
            required: false
        },
        {
            name: 'skip-animations',
            description: 'Skip game animations for faster results.',
            type: ApplicationCommandOptionType.Boolean,
            required: false
        }
    ],
    dm_permission: false
};
export const options = {
    deleted: false
};
export async function run({ interaction }) {
    try {
        const user = await checkUserRegistration({ interaction });
        if (!user)
            return;
        const configReply = await checkCasinoChannels(interaction);
        if (!configReply)
            return;
        const flips = interaction.options.getInteger('flips') || 1;
        const side = interaction.options.getString('side', true);
        const betAmount = interaction.options.getString('bet', true);
        const parsedBetAmount = parseReadableStringToNumber(betAmount);
        const readableBetAmount = formatNumberToReadableString(parsedBetAmount);
        const showBalance = interaction.options.getBoolean('show-balance');
        const skipAnimations = interaction.options.getBoolean('skip-animations');
        const isBetValid = checkValidBet(interaction, parsedBetAmount, configReply.casinoSettings.coinflip.maxBet, configReply.casinoSettings.coinflip.minBet, user.balance, flips);
        if (!isBetValid)
            return;
        const betId = generateBetId();
        const totalBet = parsedBetAmount * flips;
        await updateUserBalance({
            userId: user.userId,
            guildId: user.guildId,
            amount: -totalBet,
            lockedAmount: -Math.min(user.lockedBalance, totalBet)
        });
        await createTransaction({
            userId: user.userId,
            guildId: user.guildId,
            amount: totalBet,
            type: 'bet',
            source: 'casino',
            betId
        });
        let totalWinnings = 0;
        let liveResult = 0;
        const results = [];
        await interaction.deferReply({ withResponse: true });
        for (let i = 0; i < flips; i++) {
            if (!skipAnimations) {
                await interaction.editReply({
                    embeds: [
                        createBetEmbed(`🪙 Flipping...`, 'Blue', `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                            `🪙 **Flip Results:**\n${[...results, flipCoinEmote].join('\n')}` +
                            `\n\n💰 Total: ${liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'} **$${formatNumberToReadableString(liveResult)}**`, betId)
                    ]
                });
                await new Promise((res) => setTimeout(res, 700));
            }
            const flipResult = flipCoin();
            const win = side === flipResult;
            const winnings = win
                ? parsedBetAmount * configReply.casinoSettings.coinflip.winMultiplier
                : 0;
            results.push(`${coinEmojis[flipResult]} | ${win ? '🎉' : '❌'} | ${win
                ? `**+$${formatNumberToReadableString(winnings)}**`
                : `**-$${readableBetAmount}**`}`);
            totalWinnings += winnings;
            liveResult += winnings - parsedBetAmount;
        }
        const updatedUser = await updateUserBalance({
            userId: user.userId,
            guildId: user.guildId,
            amount: totalWinnings
        });
        if (!updatedUser)
            return;
        if (totalWinnings > 0) {
            await createTransaction({
                userId: user.userId,
                guildId: user.guildId,
                amount: totalWinnings,
                type: 'win',
                source: 'casino',
                betId
            });
        }
        const isWin = liveResult > 0;
        const isLoss = liveResult < 0;
        await interaction.editReply({
            embeds: [
                createBetEmbed(isWin
                    ? '🪙 **Win!** 🎉'
                    : isLoss
                        ? '🪙 **Better Luck Next Time...** ❌'
                        : '🪙 **Not Bad...** 👀', isWin ? 'Green' : isLoss ? 'Red' : 'Yellow', `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                    `🪙 **Flip Results:**\n${results.join('\n')}\n\n` +
                    `💰 Total: ${isWin ? '🟢' : isLoss ? '🔴' : '🟡'} **$${formatNumberToReadableString(liveResult)}**\n` +
                    (showBalance
                        ? `🏦 Balance: **$${formatNumberToReadableString(updatedUser.balance)}**`
                        : ''), betId)
            ]
        });
    }
    catch (error) {
        await handleUnexpectedInteractionError(interaction, error);
    }
}
