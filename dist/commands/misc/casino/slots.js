"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../utils/createEmbed");
const casinoHelpers_1 = require("../../../utils/casinoHelpers");
const utils_1 = require("../../../utils/utils");
const customEmotes_1 = require("../../../utils/customEmotes");
const Transaction_1 = require("../../../models/Transaction");
exports.data = {
    name: 'slots',
    description: 'Spin the slot machine!',
    options: [
        {
            name: 'bet',
            description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'spins',
            description: 'Number of spins.',
            type: discord_js_1.ApplicationCommandOptionType.Integer,
            required: false,
            choices: Array.from({ length: 10 }, (_, i) => ({
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
        {
            name: 'skip-animations',
            description: 'Skip game animations for faster results.',
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
        const spins = interaction.options.getInteger('spins') || 1;
        const betAmount = interaction.options.getString('bet', true);
        const parsedBetAmount = (0, utils_1.parseReadableStringToNumber)(betAmount);
        const readableBetAmount = (0, utils_1.formatNumberToReadableString)(parsedBetAmount);
        const showBalance = interaction.options.getBoolean('show-balance');
        const skipAnimations = interaction.options.getBoolean('skip-animations');
        const isBetValid = (0, utils_1.checkValidBet)(interaction, parsedBetAmount, configReply.casinoSettings.slots.maxBet, configReply.casinoSettings.slots.minBet, user.balance, spins);
        if (!isBetValid)
            return;
        const betId = (0, utils_1.generateBetId)();
        const totalBet = parsedBetAmount * spins;
        user.balance -= totalBet;
        await Transaction_1.default.create({
            userId: user.userId,
            guildId: user.guildId,
            amount: totalBet,
            type: 'bet',
            source: 'casino',
            betId,
            createdAt: new Date(),
        });
        let totalWinnings = 0;
        let liveResult = 0;
        const results = [];
        await interaction.deferReply({ withResponse: true });
        for (let i = 0; i < spins; i++) {
            if (!skipAnimations) {
                await interaction.editReply({
                    embeds: [
                        (0, createEmbed_1.createBetEmbed)(`🎰 Spinning...`, 'Blue', `💵 Total Bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n\n` +
                            `🕹 Spin Results:\n${results.join('\n')}${results.length ? '\n' : ''}${customEmotes_1.spinSlotEmotes[1]}${customEmotes_1.spinSlotEmotes[2]}${customEmotes_1.spinSlotEmotes[3]}` +
                            `\n\n💰 Total: ${liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(liveResult)}**`, betId),
                    ],
                });
                await new Promise((res) => setTimeout(res, 700));
            }
            const spinResult = (0, casinoHelpers_1.spinSlot)({
                symbolWeights: configReply.casinoSettings.slots.symbolWeights,
            });
            const resultString = spinResult.replace(/🍒|🫐|🍉|🔔|7️⃣/g, (match) => customEmotes_1.slotEmojis[match]);
            const winnings = (configReply.casinoSettings.slots.winMultipliers[spinResult] || 0) *
                parsedBetAmount;
            const isWin = winnings > 0;
            results.push(`**${resultString}** | ${isWin ? '🎉' : '❌'} | ${isWin
                ? `**+$${(0, utils_1.formatNumberToReadableString)(winnings)}**`
                : `**-$${readableBetAmount}**`}`);
            totalWinnings += winnings;
            liveResult += winnings - parsedBetAmount;
        }
        user.balance += totalWinnings;
        await user.save();
        if (totalWinnings > 0) {
            await Transaction_1.default.create({
                userId: user.userId,
                guildId: user.guildId,
                amount: totalWinnings,
                type: 'win',
                source: 'casino',
                betId,
                createdAt: new Date(),
            });
        }
        const isWin = liveResult > 0;
        const isLoss = liveResult < 0;
        await interaction.editReply({
            embeds: [
                (0, createEmbed_1.createBetEmbed)(isWin
                    ? '🎰 **Win!** 🎉'
                    : isLoss
                        ? '🎰 **Better Luck Next Time...** ❌'
                        : '🎰 **Not Bad...** 👀', isWin ? 'Green' : isLoss ? 'Red' : 'Yellow', `💵 Total Bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n\n` +
                    `🕹 **Spin Results:**\n${results.join('\n')}\n\n` +
                    `💰 Total: ${isWin ? '🟢' : isLoss ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(liveResult)}**\n` +
                    (showBalance
                        ? `🏦 Balance: **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**`
                        : ''), betId),
            ],
        });
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
