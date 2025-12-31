import { ApplicationCommandOptionType } from 'discord.js';
import { handleUnexpectedInteractionError } from '@/errors';
import { checkCasinoChannels, checkUserRegistration, createTransaction, updateUserBalance } from '@/services';
import { spinSlot } from '@/utils/casino/rng';
import { checkValidBet, formatNumberToReadableString, generateBetId, parseReadableStringToNumber } from '@/utils/common/utils';
import { createBetEmbed } from '@/utils/discord/createEmbed';
import { slotEmojis, spinSlotEmotes } from '@/utils/discord/customEmotes';
export const data = {
    name: 'slots',
    description: 'Spin the slot machine!',
    options: [
        {
            name: 'bet',
            description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'spins',
            description: 'Number of spins.',
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
        const spins = interaction.options.getInteger('spins') || 1;
        const betAmount = interaction.options.getString('bet', true);
        const parsedBetAmount = parseReadableStringToNumber(betAmount);
        const readableBetAmount = formatNumberToReadableString(parsedBetAmount);
        const showBalance = interaction.options.getBoolean('show-balance');
        const skipAnimations = interaction.options.getBoolean('skip-animations');
        const isBetValid = checkValidBet(interaction, parsedBetAmount, configReply.casinoSettings.slots.maxBet, configReply.casinoSettings.slots.minBet, user.balance, spins);
        if (!isBetValid)
            return;
        const betId = generateBetId();
        const totalBet = parsedBetAmount * spins;
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
        for (let i = 0; i < spins; i++) {
            if (!skipAnimations) {
                await interaction.editReply({
                    embeds: [
                        createBetEmbed(`🎰 Spinning...`, 'Blue', `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                            `🕹 Spin Results:\n${results.join('\n')}${results.length ? '\n' : ''}${spinSlotEmotes[1]}${spinSlotEmotes[2]}${spinSlotEmotes[3]}` +
                            `\n\n💰 Total: ${liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'} **$${formatNumberToReadableString(liveResult)}**`, betId)
                    ]
                });
                await new Promise((res) => setTimeout(res, 700));
            }
            const spinResult = spinSlot({
                symbolWeights: configReply.casinoSettings.slots.symbolWeights
            });
            const resultString = spinResult.replace(/🍒|🫐|🍉|🔔|7️⃣/g, (match) => slotEmojis[match]);
            const winnings = (configReply.casinoSettings.slots.winMultipliers[spinResult] || 0) *
                parsedBetAmount;
            const isWin = winnings > 0;
            results.push(`**${resultString}** | ${isWin ? '🎉' : '❌'} | ${isWin
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
                    ? '🎰 **Win!** 🎉'
                    : isLoss
                        ? '🎰 **Better Luck Next Time...** ❌'
                        : '🎰 **Not Bad...** 👀', isWin ? 'Green' : isLoss ? 'Red' : 'Yellow', `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**\n\n` +
                    `🕹 **Spin Results:**\n${results.join('\n')}\n\n` +
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
