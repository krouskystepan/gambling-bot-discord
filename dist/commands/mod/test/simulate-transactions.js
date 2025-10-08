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
            description: 'Maximum amount per transaction (upper bound).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'days',
            description: 'How many past days to simulate over (default: 30).',
            type: discord_js_1.ApplicationCommandOptionType.Integer,
            required: false,
        },
        {
            name: 'unique-users',
            description: 'Number of distinct users to simulate (default: auto).',
            type: discord_js_1.ApplicationCommandOptionType.Integer,
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
// Weighted type probabilities
const TYPE_WEIGHTS = {
    bet: 30,
    win: 25,
    deposit: 15,
    withdraw: 10,
    bonus: 8,
    vip: 7,
    refund: 5,
};
function weightedRandomChoice(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    const rand = Math.random() * total;
    let acc = 0;
    for (const [key, weight] of entries) {
        acc += weight;
        if (rand <= acc)
            return key;
    }
    return entries[entries.length - 1][0];
}
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function randomString(length = 8) {
    return Math.random()
        .toString(36)
        .substring(2, 2 + length);
}
function randomDateWithinDays(days) {
    const now = Date.now();
    const offset = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
    return new Date(now - offset);
}
function getRandomAmount(type, maxAmount) {
    const ranges = {
        bet: [100, Math.min(maxAmount, 1000)],
        win: [150, Math.min(maxAmount, 1200)],
        refund: [1, 50],
        deposit: [20, 200],
        withdraw: [20, 200],
        bonus: [10, 100],
        vip: [10, 100],
    };
    const [min, max] = ranges[type] || [1, maxAmount];
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
async function run({ interaction }) {
    try {
        const count = (0, utils_1.parseReadableStringToNumber)(interaction.options.getString('count', true));
        const maxAmount = (0, utils_1.parseReadableStringToNumber)(interaction.options.getString('max-amount') || '1000');
        const days = interaction.options.getInteger('days') ?? 30;
        const uniqueUsers = interaction.options.getInteger('unique-users') ??
            Math.max(5, Math.floor(count / 10));
        const MAX_INPUT = 500_000;
        if (count > MAX_INPUT) {
            return interaction.reply({
                content: `⚠️ Max ${MAX_INPUT} transactions at once.`,
            });
        }
        await interaction.deferReply();
        const userIds = Array.from({ length: uniqueUsers }, () => randomString(8));
        const transactions = [];
        const typeCount = {};
        for (let i = 0; i < count; i++) {
            const type = weightedRandomChoice(TYPE_WEIGHTS);
            typeCount[type] = (typeCount[type] ?? 0) + 1;
            const userId = randomChoice(userIds);
            const amount = getRandomAmount(type, maxAmount);
            transactions.push({
                userId,
                guildId: interaction.guildId,
                amount,
                type,
                source: randomChoice(SOURCES),
                betId: ['bet', 'win', 'refund'].includes(type)
                    ? randomString(6)
                    : undefined,
                handledBy: Math.random() < 0.25 ? randomString(6) : undefined,
                createdAt: randomDateWithinDays(days),
            });
        }
        await Transaction_1.default.insertMany(transactions);
        const summary = Object.entries(typeCount)
            .sort(([, a], [, b]) => b - a)
            .map(([type, c]) => `• **${type}**: ${(0, utils_1.formatNumberToReadableString)(c)}`)
            .join('\n');
        await interaction.editReply({
            content: `✅ Simulated **${(0, utils_1.formatNumberToReadableString)(count)}** transactions across **${uniqueUsers}** users\n🗓️ Period: last **${days}** days\n\n**Breakdown:**\n${summary}`,
        });
    }
    catch (error) {
        console.error('Error simulating transactions:', error);
        await interaction.editReply({
            content: '❌ Something went wrong while simulating transactions.',
        });
    }
}
