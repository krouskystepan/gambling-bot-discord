"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const utils_1 = require("../../../utils/utils");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const VipRoom_1 = require("../../../models/VipRoom");
const rtpCalcHelper_1 = require("../../../utils/rtpCalcHelper");
exports.data = {
    name: 'casino-info',
    description: 'Get information about the casino.',
    options: [
        {
            name: 'games',
            description: 'Show information about casino games',
            type: discord_js_1.ApplicationCommandOptionType.Boolean,
            required: false,
        },
        {
            name: 'config',
            description: 'Show server casino configuration',
            type: discord_js_1.ApplicationCommandOptionType.Boolean,
            required: false,
        },
        {
            name: 'admin',
            description: 'Show administrator-only information (contains sensitive data)',
            type: discord_js_1.ApplicationCommandOptionType.Boolean,
            required: false,
        },
    ],
    dm_permission: false,
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false,
};
const formatRTP = (rtp) => {
    return `- **RTP:** ${(rtp * 100).toFixed(2)}%`;
};
const formatBet = (label, value) => {
    return `- **${label}:** ${value === 0 ? 'No Limit' : (0, utils_1.formatNumberToReadableString)(value)}`;
};
const formatRooms = (label, ids, fallback = 'No rooms') => {
    if (!ids || !ids.length)
        return `- **${label}**: ${fallback}`;
    const formattedIds = ids.map((id) => `  - <#${id}> (${id})`).join('\n');
    return `- **${label}**:\n${formattedIds}`;
};
const formatCategory = (label, id, fallback = 'No category') => {
    if (!id)
        return `- **${label}**: ${fallback}`;
    return `- **${label}**: <#${id}> (${id})`;
};
const formatMultipleRooms = (label, ids) => {
    if (!ids)
        return `- **${label}**: No rooms`;
    const formatField = (value) => {
        if (!value || (Array.isArray(value) && value.length === 0))
            return 'No channel';
        return Array.isArray(value)
            ? value.map((id) => `<#${id}> (${id})`).join(', ')
            : value.trim() === ''
                ? 'No channel'
                : `<#${value}> (${value})`;
    };
    const actions = formatField(ids.actions);
    const logs = formatField(ids.logs);
    return `- **${label}**\n  - Actions: ${actions}\n  - Logs: ${logs}`;
};
const formatRole = (label, id) => {
    return `- **${label}:** ${id ? `<@&${id}> (${id})` : 'No role'}`;
};
const renderSection = (title, baseLines, adminLines, isAdmin) => {
    const lines = [];
    if (isAdmin && adminLines?.length)
        lines.push(...adminLines);
    lines.push(...baseLines);
    return `## ${title}\n${lines.join('\n')}`;
};
async function run({ interaction }) {
    const config = await GuildConfiguration_1.default.findOne({
        guildId: interaction.guildId,
    });
    if (!config?.casinoSettings)
        return;
    const vipRooms = await VipRoom_1.default.find({ guildId: interaction.guildId }, { channelId: 1, _id: 0 });
    const vipChannelIds = vipRooms.map((room) => room.channelId);
    const settings = config.casinoSettings;
    console.log(config.predictionChannelIds);
    const showGames = interaction.options.getBoolean('games') ?? true;
    const showConfig = interaction.options.getBoolean('config') ?? true;
    const showAdmin = interaction.options.getBoolean('admin') ?? false;
    const sections = [];
    if (showGames) {
        sections.push(renderSection('🎲 Dice', [
            `- **Multiplier:** ${settings.dice.winMultiplier}x`,
            formatBet('Max Bet', settings.dice.maxBet),
            formatBet('Min Bet', settings.dice.minBet),
        ], [formatRTP((0, rtpCalcHelper_1.calculateRTP)('dice', settings.dice))], showAdmin), renderSection('🪙 Coin Flip', [
            `- **Multiplier:** ${settings.coinflip.winMultiplier}x`,
            formatBet('Max Bet', settings.coinflip.maxBet),
            formatBet('Min Bet', settings.coinflip.minBet),
        ], [formatRTP((0, rtpCalcHelper_1.calculateRTP)('coinflip', settings.coinflip))], showAdmin), renderSection('🎰 Slots', [
            `- **Multipliers:** \n${Object.entries(settings.slots.winMultipliers)
                .map(([symbol, multiplier]) => `  - ${symbol}: ${multiplier}x`)
                .join('\n')}`,
            formatBet('Max Bet', settings.slots.maxBet),
            formatBet('Min Bet', settings.slots.minBet),
        ], [
            formatRTP((0, rtpCalcHelper_1.calculateRTP)('slots', settings.slots)),
            `- **Symbol Weights:** \n${Object.entries(settings.slots.symbolWeights)
                .map(([symbol, weight]) => `  - ${symbol}: ${weight}`)
                .join('\n')}`,
        ], showAdmin), renderSection('🎟️ Lottery', [
            `- **Multipliers:** \n${Object.entries(settings.lottery.winMultipliers)
                .map(([symbol, multiplier]) => `  - ${symbol}: ${multiplier}x`)
                .join('\n')}`,
            formatBet('Max Bet', settings.lottery.maxBet),
            formatBet('Min Bet', settings.lottery.minBet),
        ], [formatRTP((0, rtpCalcHelper_1.calculateRTP)('lottery', settings.lottery))], showAdmin), renderSection('🤑 Golden Jackpot', [
            `- **Multiplier:** ${(0, utils_1.formatNumberWithSpaces)(settings.goldenJackpot.winMultiplier)}x`,
            formatBet('Max Bet', settings.goldenJackpot.maxBet),
            formatBet('Min Bet', settings.goldenJackpot.minBet),
        ], [
            formatRTP((0, rtpCalcHelper_1.calculateRTP)('goldenJackpot', settings.goldenJackpot)),
            `- **One in Chance:** 1 in ${(0, utils_1.formatNumberWithSpaces)(settings.goldenJackpot.oneInChance)}`,
        ], showAdmin), renderSection('🪨📄✂️ RPS', [
            `- **Casino Cut:** ${settings.rps.casinoCut * 100}%`,
            formatBet('Max Bet', settings.rps.maxBet),
            formatBet('Min Bet', settings.rps.minBet),
        ], [formatRTP((0, rtpCalcHelper_1.calculateRTP)('rps', settings.rps))], showAdmin), renderSection('🃏 Blackjack', [
            formatBet('Max Bet', settings.blackjack.maxBet),
            formatBet('Min Bet', settings.blackjack.minBet),
        ], [formatRTP((0, rtpCalcHelper_1.calculateRTP)('blackjack', settings.blackjack))], showAdmin), renderSection('👀 Prediction', [
            formatBet('Max Bet', settings.prediction.maxBet),
            formatBet('Min Bet', settings.prediction.minBet),
        ]));
    }
    if (showConfig) {
        sections.push(renderSection('⚙️ Server Config', [
            formatRole('VIP Role', config.vipSettings.roleId),
            `- **VIP Price Per Day:** ${config.vipSettings.pricePerDay === 0
                ? 'Not Set'
                : `$${(0, utils_1.formatNumberToReadableString)(config.vipSettings.pricePerDay)}`}`,
            `- **VIP Create Price:** ${config.vipSettings.pricePerCreate === 0
                ? 'Not Set'
                : `$${(0, utils_1.formatNumberToReadableString)(config.vipSettings.pricePerCreate)}`}`,
            '',
            formatRole('Manager Role', config.managerRoleId),
        ], [
            formatMultipleRooms('ATM Rooms', config.atmChannelIds),
            formatMultipleRooms('Prediction Rooms', config.predictionChannelIds),
            formatRooms('Gambling Rooms', config.casinoChannelIds),
            formatRooms('Admin Rooms', config.adminChannelIds),
            formatRooms('VIP Active Rooms', vipChannelIds),
            '',
            formatCategory('VIP Category', config.vipSettings.categoryId),
        ], showAdmin));
    }
    const content = sections.length > 0
        ? `# Casino Information\n${sections.join('\n\n')}`
        : `# Casino Information\n- No information selected.`;
    return interaction.reply({ content });
}
