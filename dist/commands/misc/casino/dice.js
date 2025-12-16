import { ApplicationCommandOptionType } from 'discord.js';
import { handleUnexpectedInteractionError } from '@/errors';
import { checkCasinoChannels, checkUserRegistration, createTransaction, updateUserBalance } from '@/services';
import { rollDice } from '@/utils/casinoHelpers';
import { createBetEmbed } from '@/utils/createEmbed';
import { diceEmojis, rollDiceEmote } from '@/utils/customEmotes';
import { checkValidBet, formatNumberToReadableString, generateBetId, parseReadableStringToNumber } from '@/utils/utils';
export const data = {
    name: 'dice',
    description: 'Play a dice game!',
    options: [
        {
            name: 'bet',
            description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'side',
            description: 'Choose a dice side.',
            type: ApplicationCommandOptionType.Integer,
            required: true,
            choices: Array.from({ length: 6 }, (_, i) => ({
                name: (i + 1).toString(),
                value: i + 1
            }))
        },
        {
            name: 'rolls',
            description: 'Number of rolls.',
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
        const rolls = interaction.options.getInteger('rolls') || 1;
        const side = interaction.options.getInteger('side', true);
        const betAmount = interaction.options.getString('bet', true);
        const parsedBetAmount = parseReadableStringToNumber(betAmount);
        const readableBetAmount = formatNumberToReadableString(parsedBetAmount);
        const showBalance = interaction.options.getBoolean('show-balance');
        const skipAnimations = interaction.options.getBoolean('skip-animations');
        const isBetValid = checkValidBet(interaction, parsedBetAmount, configReply.casinoSettings.dice.maxBet, configReply.casinoSettings.dice.minBet, user.balance, rolls);
        if (!isBetValid)
            return;
        const betId = generateBetId();
        const totalBet = parsedBetAmount * rolls;
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
        await interaction.deferReply({
            withResponse: true
        });
        for (let i = 0; i < rolls; i++) {
            if (!skipAnimations) {
                await interaction.editReply({
                    embeds: [
                        createBetEmbed(`🎲 Rolling...`, 'Blue', `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                            `🎲 **Roll Results:**\n${[...results, rollDiceEmote].join('\n')}` +
                            `\n\n💰 Total: ${liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'} **$${formatNumberToReadableString(liveResult)}**`, betId)
                    ]
                });
                await new Promise((res) => setTimeout(res, 700));
            }
            const dice = rollDice();
            const win = side === dice;
            const winnings = win
                ? parsedBetAmount * configReply.casinoSettings.dice.winMultiplier
                : 0;
            results.push(`${diceEmojis[dice]} | ${win ? '🎉' : '❌'} | ${win
                ? `+$${formatNumberToReadableString(winnings)}`
                : `-$${readableBetAmount}`}`);
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
                    ? '🎲 **Win!** 🎉'
                    : isLoss
                        ? '🎲 **Better Luck Next Time...** ❌'
                        : '🎲 **Not Bad...** 👀', isWin ? 'Green' : isLoss ? 'Red' : 'Yellow', `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                    `🎲 **Roll Results:**\n${results.join('\n')}\n\n` +
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
