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
    description: 'Play American roulette with multiple bets!',
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
    ],
    dm_permission: false,
};
exports.options = {
    deleted: false,
    devOnly: true,
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
        const showBalance = interaction.options.getBoolean('show-balance') || false;
        const bets = [];
        for (const betStr of betsInput.split(',')) {
            const [amountStr, value] = betStr.trim().split(/\s+/);
            if (!amountStr || !value) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Bet Format', `Each bet must be in the format: "<amount> <value>". Invalid: "${betStr.trim()}"`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const amount = (0, utils_1.parseReadableStringToNumber)(amountStr);
            // Validate numeric amount
            const isBetValid = (0, utils_1.checkValidBet)(interaction, amount, 
            // configReply.casinoSettings?.roulette.maxBet || 0,
            // configReply.casinoSettings?.roulette.minBet || 0,
            0, 0, user.balance, spins);
            if (!isBetValid)
                return;
            let type;
            try {
                type = (0, rouletteUtils_1.inferTypeFromValue)(value);
            }
            catch (e) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Invalid Bet Value', `Invalid bet value: "${value}"\n${e.message}`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            bets.push({ amount, type, value });
        }
        if (bets.length === 0) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - No Bets Found', 'Please provide at least one valid bet.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
        let totalNet = 0;
        const resultsMap = {};
        // Run spins
        for (let i = 0; i < spins; i++) {
            const spinResult = (0, casinoHelpers_1.spinRouletteWheel)();
            const color = (0, rouletteUtils_1.getRouletteColor)(spinResult);
            const key = `${color} ${spinResult}`;
            if (!resultsMap[key])
                resultsMap[key] = [];
            for (const bet of bets) {
                const winnings = (0, rouletteUtils_1.calculateRouletteWin)(bet, spinResult, configReply.casinoSettings.roulette.winMultipliers);
                const net = winnings - bet.amount;
                totalNet += net;
                resultsMap[key].push(`- Bet: $${(0, utils_1.formatNumberToReadableString)(bet.amount)} on ${bet.value} → ${net > 0
                    ? `🎉 +$${(0, utils_1.formatNumberToReadableString)(net)}`
                    : net < 0
                        ? `❌ -$${(0, utils_1.formatNumberToReadableString)(bet.amount)}`
                        : '$0'}`);
            }
        }
        // Prepare final results string
        const results = [];
        for (const [spin, betsArr] of Object.entries(resultsMap)) {
            results.push(`${spin}\n${betsArr.join('\n')}`);
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
                    `🎲 **Spin Results:**\n${results.join('\n\n')}\n\n` +
                    `💰 Total: ${isWin ? '🟢' : isLoss ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(totalNet)}**\n` +
                    (showBalance
                        ? `🏦 Balance: **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**`
                        : '')),
            ],
        });
    }
    catch (error) {
        console.error('Error running roulette command:', error);
        return interaction.reply({
            embeds: [
                (0, createEmbed_1.createErrorEmbed)('Error', 'An unexpected error occurred while processing your bet.'),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
