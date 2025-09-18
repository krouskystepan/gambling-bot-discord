"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../utils/createEmbed");
const utils_1 = require("../../../utils/utils");
const casinoHelpers_1 = require("../../../utils/casinoHelpers");
const rouletteUtils_1 = require("../../../utils/rouletteUtils");
const Transaction_1 = require("../../../models/Transaction");
const User_1 = require("../../../models/User");
exports.data = {
    name: 'roulette',
    description: 'Play Mini Roulette with multiple bets!',
    options: [
        {
            name: 'bets',
            description: 'Your bets (e.g., "100 red, 50 17, 200 d2, 75 c1")',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'spins',
            description: 'Number of spins.',
            type: discord_js_1.ApplicationCommandOptionType.Integer,
            required: false,
            choices: Array.from({ length: 5 }, (_, i) => ({
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
        const betsInput = interaction.options.getString('bets', true);
        const showBalance = interaction.options.getBoolean('show-balance');
        const skipAnimations = interaction.options.getBoolean('skip-animations');
        const bets = [];
        for (const betStr of betsInput.split(',')) {
            const [amountStr, rawValue] = betStr.trim().split(/\s+/);
            if (!amountStr || !rawValue) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Bet Format', `Each bet must be in the format: "<amount> <value>". Invalid: "${betStr.trim()}"`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const amount = (0, utils_1.parseReadableStringToNumber)(amountStr);
            let type;
            try {
                type = (0, rouletteUtils_1.inferTypeFromValue)(rawValue);
            }
            catch (e) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Bet Value', `${e.message}`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            let value = rawValue;
            let displayValue = value;
            if (type === 'dozen')
                value = value[1];
            if (type === 'column')
                value = value[1];
            bets.push({ amount, type, value, displayValue });
        }
        if (bets.length === 0) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - No Bets Found', 'Please provide at least one valid bet.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const totalOneSpin = bets.reduce((sum, b) => sum + b.amount, 0);
        const isBetValid = (0, utils_1.checkValidBet)(interaction, totalOneSpin, configReply.casinoSettings.roulette.maxBet, configReply.casinoSettings.roulette.minBet, user.balance, spins);
        if (!isBetValid)
            return;
        const betId = (0, utils_1.generateBetId)();
        const totalBet = totalOneSpin * spins;
        await User_1.default.findOneAndUpdate({ userId: user.userId, guildId: user.guildId }, {
            $inc: {
                balance: -totalBet,
                lockedBalance: -Math.min(user.lockedBalance, totalBet),
            },
        });
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
                        (0, createEmbed_1.createBetEmbed)('🌀 Spinning...', 'Blue', `💵 Total Bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n\n` +
                            `🕹 Spin Results:\n${results.join('\n\n')}\n\n` +
                            `💰 Total: ${liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(liveResult)}**`, betId),
                    ],
                });
                await new Promise((res) => setTimeout(res, 700));
            }
            const spinResult = (0, casinoHelpers_1.spinRouletteWheel)();
            const color = (0, rouletteUtils_1.getRouletteColor)(spinResult);
            let spinOutput = `**${color} ${spinResult}**`;
            let winnings = 0;
            for (const bet of bets) {
                const winAmount = (0, rouletteUtils_1.calculateRouletteWin)(bet, spinResult, configReply.casinoSettings.roulette.winMultipliers);
                winnings += winAmount;
                spinOutput += `\n**$${(0, utils_1.formatNumberToReadableString)(bet.amount)}** on ${bet.displayValue ?? bet.value} | ${winAmount > 0
                    ? `🎉 | +$${(0, utils_1.formatNumberToReadableString)(winAmount)}`
                    : `❌ | -$${(0, utils_1.formatNumberToReadableString)(bet.amount)}`}`;
            }
            totalWinnings += winnings;
            const totalBetPerSpin = bets.reduce((sum, b) => sum + b.amount, 0);
            liveResult += winnings - totalBetPerSpin;
            results.push(spinOutput);
        }
        const updatedUser = await User_1.default.findOneAndUpdate({ userId: user.userId, guildId: user.guildId }, { $inc: { balance: totalWinnings } }, { new: true });
        if (!updatedUser)
            return;
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
                    ? '🌀 **Win!** 🎉'
                    : isLoss
                        ? '🌀 **Better Luck Next Time...** ❌'
                        : '🌀 **Not Bad...** 👀', isWin ? 'Green' : isLoss ? 'Red' : 'Yellow', `💵 Total Bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n\n` +
                    `🕹 **Spin Results:**\n${results.join('\n\n')}\n\n` +
                    `💰 Total: ${isWin ? '🟢' : isLoss ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(liveResult)}**\n` +
                    (showBalance
                        ? `🏦 Balance: **$${(0, utils_1.formatNumberToReadableString)(updatedUser.balance)}**`
                        : ''), betId),
            ],
        });
    }
    catch (error) {
        console.error('Error running roulette command:', error);
    }
}
