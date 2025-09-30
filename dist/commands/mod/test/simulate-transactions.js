"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const Transaction_1 = require("../../../models/Transaction");
const utils_1 = require("../../../utils/utils");
exports.data = {
    name: 'simulate-transactions',
    description: 'Simulate X transactions for testing filtering and indexing.',
    options: [
        {
            name: 'count',
            description: 'Number of transactions to simulate.',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'max-amount',
            description: 'Maximum amount per transaction.',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: false,
        },
    ],
    dm_permission: false,
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    devOnly: true,
};
const TYPES = [
    'deposit',
    'withdraw',
    'bet',
    'win',
    'refund',
    'bonus',
    'vip',
];
const SOURCES = ['command', 'manual', 'web', 'system', 'casino'];
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function randomString(length = 8) {
    return Math.random()
        .toString(36)
        .substring(2, 2 + length);
}
async function run({ interaction }) {
    try {
        const count = (0, utils_1.parseReadableStringToNumber)(interaction.options.getString('count', true));
        const maxAmount = (0, utils_1.parseReadableStringToNumber)(interaction.options.getString('max-amount') || '1000');
        if (count > 100_000) {
            return interaction.reply({
                content: 'Max 100,000 transactions at once.',
            });
        }
        await interaction.deferReply();
        const transactions = [];
        for (let i = 0; i < count; i++) {
            transactions.push({
                userId: randomString(8),
                guildId: interaction.guildId,
                amount: Math.floor(Math.random() * maxAmount) + 1,
                type: randomChoice(TYPES),
                source: randomChoice(SOURCES),
                betId: Math.random() < 0.5 ? randomString(6) : undefined,
                handledBy: Math.random() < 0.3 ? randomString(6) : undefined,
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 1_000_000_000)),
            });
        }
        await Transaction_1.default.insertMany(transactions);
        await interaction.editReply({
            content: `✅ Successfully simulated ${(0, utils_1.formatNumberToReadableString)(count)} transactions!`,
        });
    }
    catch (error) {
        console.error('Error simulating transactions:', error);
        interaction.editReply({
            content: '❌ Something went wrong while simulating transactions.',
        });
    }
}
