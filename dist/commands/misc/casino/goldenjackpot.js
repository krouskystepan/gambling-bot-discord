"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../utils/createEmbed");
const utils_1 = require("../../../utils/utils");
const casinoHelpers_1 = require("../../../utils/casinoHelpers");
const GOLDEN_JACKPOT_MAX_ENTRIES = 100;
exports.data = {
    name: 'goldenjackpot',
    description: `Try your luck at the Golden Jackpot HUGEx!`,
    options: [
        {
            name: 'bet',
            description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'entries',
            description: `Number of entries (max is ${GOLDEN_JACKPOT_MAX_ENTRIES}).`,
            type: discord_js_1.ApplicationCommandOptionType.Integer,
            required: false,
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
        const entries = interaction.options.getInteger('entries') || 1;
        const betAmount = interaction.options.getString('bet', true);
        const parsedBetAmount = (0, utils_1.parseReadableStringToNumber)(betAmount);
        const showBalance = interaction.options.getBoolean('show-balance');
        const skipAnimations = interaction.options.getBoolean('skip-animations');
        if (entries > GOLDEN_JACKPOT_MAX_ENTRIES || entries < 1) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Entries', `The number of entries must be between 1 and ${GOLDEN_JACKPOT_MAX_ENTRIES}.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const isBetValid = (0, utils_1.checkValidBet)(interaction, parsedBetAmount, configReply.casinoSettings.goldenJackpot.maxBet, configReply.casinoSettings.goldenJackpot.minBet, user.balance, entries);
        if (!isBetValid)
            return;
        const totalBet = parsedBetAmount * entries;
        user.balance -= totalBet;
        const initialTickets = entries;
        let totalWinnings = 0;
        let liveResult = 0;
        let jackpotTries = [];
        await interaction.deferReply({ withResponse: true });
        await interaction.editReply({
            embeds: [
                (0, createEmbed_1.createBetEmbed)(`🤑 Drawing...`, 'Blue', `💵 Total Bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n\n` +
                    `🎟️ Tickets left: **${initialTickets}**\n` +
                    `\n💰 Total: ${liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(liveResult)}**`),
            ],
        });
        await new Promise((res) => setTimeout(res, 1000));
        let step = 1;
        if (entries > 50)
            step = 10;
        else if (entries > 20)
            step = 5;
        else if (entries > 10)
            step = 2;
        for (let i = 0; i < entries; i++) {
            const tryNumber = i + 1;
            const jackpotNumber = (0, casinoHelpers_1.drawGoldenJackpot)(configReply.casinoSettings.goldenJackpot);
            const isJackpot = jackpotNumber === 1;
            const winnings = isJackpot
                ? parsedBetAmount *
                    configReply.casinoSettings.goldenJackpot.winMultiplier
                : 0;
            totalWinnings += winnings;
            liveResult += winnings - parsedBetAmount;
            if (isJackpot) {
                jackpotTries.push(`**JACKPOT!** You won **$${(0, utils_1.formatNumberToReadableString)(winnings)}** on Try **#${tryNumber.toString().padStart(3, '0')}**! 🔥`);
            }
            if (!skipAnimations) {
                let ticketsLeft = initialTickets - tryNumber;
                if (initialTickets > 10) {
                    ticketsLeft = Math.ceil(ticketsLeft / step) * step;
                }
                if (tryNumber % step === 0 || tryNumber === entries) {
                    await interaction.editReply({
                        embeds: [
                            (0, createEmbed_1.createBetEmbed)(`🤑 Drawing...`, 'Blue', `💵 Total Bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n\n` +
                                `🎟️ Tickets left: **${ticketsLeft}**\n` +
                                (jackpotTries.length > 0
                                    ? `\n**🤑 JACKPOT WINS:**\n${jackpotTries.join('\n')}\n`
                                    : '') +
                                `\n💰 Total: ${liveResult > 0 ? '🟢' : liveResult < 0 ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(liveResult)}**`),
                        ],
                    });
                    await new Promise((res) => setTimeout(res, 1000));
                }
            }
        }
        user.balance += totalWinnings;
        user.netProfit += liveResult;
        await user.save();
        const isWin = liveResult > 0;
        const isLoss = liveResult < 0;
        await interaction.editReply({
            embeds: [
                (0, createEmbed_1.createBetEmbed)(isWin
                    ? '🤑 **JACKPOT!** 🎉'
                    : isLoss
                        ? '🤑 **Better Luck Next Time...** ❌'
                        : '🤑 **Not Bad...** 👀', isWin ? 'Green' : isLoss ? 'Red' : 'Yellow', `💵 Total Bet: **$${(0, utils_1.formatNumberToReadableString)(totalBet)}**\n\n` +
                    `🤑 **Draw Result:**${isWin ? `\n ${jackpotTries.join('\n')}` : ' No win'}\n\n` +
                    `💰 Total: ${isWin ? '🟢' : isLoss ? '🔴' : '🟡'} **$${(0, utils_1.formatNumberToReadableString)(liveResult)}**\n` +
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
