"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const utils_1 = require("../../../utils/utils");
const defaultConfig_1 = require("../../../utils/defaultConfig");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const VipRoom_1 = require("../../../models/VipRoom");
exports.data = {
    name: 'casino-info',
    description: 'Get information about the casino.',
    options: [
        {
            name: 'admin',
            description: 'Get information about the casino administrators (contains sensitive information).',
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
    return ` - **${label}**: <#${id}> (${id})`;
};
const formatAtmRooms = (label, ids) => {
    if (!ids)
        return `- **${label}**: No rooms`;
    const actions = ids.actions
        ? `<#${ids.actions}> (${ids.actions})`
        : 'No channel';
    const logs = ids.logs ? `<#${ids.logs}> (${ids.logs})` : 'No channel';
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
    const vipRooms = await VipRoom_1.default.find({ guildId: interaction.guildId }, { channelId: 1, _id: 0 });
    const vipChannelIds = vipRooms.map((room) => room.channelId);
    const settings = config?.casinoSettings;
    if (!settings)
        return;
    const isAdmin = interaction.options.getBoolean('admin') ?? false;
    const games = [
        renderSection('🎲 Dice', [
            `- **Multiplier:** ${settings.dice.winMultiplier}x`,
            formatBet('Max Bet', settings.dice.maxBet),
            formatBet('Min Bet', settings.dice.minBet),
        ], [
            `- **Max Simulate Rolls:** ${(0, utils_1.formatNumberToReadableString)(defaultConfig_1.DICE_MAX_SIMULATE_ROLLS)}`,
        ], isAdmin),
        renderSection('🪙 Coin Flip', [
            `- **Multiplier:** ${settings.coinflip.winMultiplier}x`,
            formatBet('Max Bet', settings.coinflip.maxBet),
            formatBet('Min Bet', settings.coinflip.minBet),
        ], [
            `- **Max Simulate Flips:** ${(0, utils_1.formatNumberToReadableString)(defaultConfig_1.COINFLIP_MAX_SIMULATE_FLIPS)}`,
        ], isAdmin),
        renderSection('🎰 Slots', [
            `- **Multipliers:** \n${Object.entries(settings.slots.winMultipliers)
                .map(([symbol, multiplier]) => `  - ${symbol}: ${multiplier}x`)
                .join('\n')}`,
            formatBet('Max Bet', settings.slots.maxBet),
            formatBet('Min Bet', settings.slots.minBet),
        ], [
            `- **Max Simulate Spins:** ${(0, utils_1.formatNumberToReadableString)(defaultConfig_1.SLOT_MAX_SIMULATE_SPINS)}`,
            `- **Symbol Weights:** \n${Object.entries(settings.slots.symbolWeights)
                .map(([symbol, weight]) => `  - ${symbol}: ${weight}`)
                .join('\n')}`,
        ], isAdmin),
        renderSection('🎟️ Lottery', [
            `- **Multipliers:** \n${Object.entries(settings.lottery.winMultipliers)
                .map(([symbol, multiplier]) => `  - ${symbol}: ${multiplier}x`)
                .join('\n')}`,
            formatBet('Max Bet', settings.lottery.maxBet),
            formatBet('Min Bet', settings.lottery.minBet),
        ], [
            `- **Max Simulate Entries:** ${(0, utils_1.formatNumberToReadableString)(defaultConfig_1.LOTTERY_MAX_SIMULATE_ENTRIES)}`,
        ], isAdmin),
        renderSection('🤑 Golden Jackpot', [
            `- **Multiplier:** ${(0, utils_1.formatNumberWithSpaces)(settings.goldenJackpot.winMultiplier)}x`,
            formatBet('Max Bet', settings.goldenJackpot.maxBet),
            formatBet('Min Bet', settings.goldenJackpot.minBet),
        ], [
            `- **Max Simulate Entries:** ${(0, utils_1.formatNumberToReadableString)(defaultConfig_1.GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES)}`,
            `- **One in Chance:** 1 in ${(0, utils_1.formatNumberWithSpaces)(settings.goldenJackpot.oneInChance)}`,
        ], isAdmin),
        renderSection('🪨📄✂️ RPS', [
            `- **Casino Cut:** ${settings.rps.casinoCut * 100}%`,
            formatBet('Max Bet', settings.rps.maxBet),
            formatBet('Min Bet', settings.rps.minBet),
        ]),
        renderSection('🃏 Blackjack', [
            formatBet('Max Bet', settings.blackjack.maxBet),
            formatBet('Min Bet', settings.blackjack.minBet),
        ]),
        renderSection('⚙️ Server Config', [
            formatAtmRooms('ATM Rooms', config.atmChannelIds),
            formatRooms('Gambling Rooms', config.casinoChannelIds),
            formatRooms('Admin Rooms', config.adminChannelIds),
            '',
            formatRole('Manager Role', config.managerRoleId),
            '',
            formatRooms('VIP Rooms', vipChannelIds),
            `- **VIP Price Per Day:** ${config.vipSettings.pricePerDay === 0
                ? 'Not Set'
                : `$${(0, utils_1.formatNumberToReadableString)(config.vipSettings.pricePerDay)}`}`,
            formatRole('VIP Role', config.vipSettings.roleId),
            formatCategory('VIP Category', config.vipSettings.categoryId),
        ]),
    ];
    return interaction.reply({
        content: `# ${isAdmin ? 'Admin' : ''} Casino Information\n${games.join('\n\n')}`,
    });
}
