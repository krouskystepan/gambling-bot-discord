import { calculateRTP } from 'gambling-bot-shared';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { getAllActiveVipsByGuildId, getGuildConfigByGuildId } from '@/services';
import { createErrorEmbed } from '@/utils/createEmbed';
import { formatNumberToReadableString, formatNumberWithSpaces } from '@/utils/utils';
export const data = {
    name: 'casino-info',
    description: 'Get information about the casino.',
    options: [
        {
            name: 'games',
            description: 'Show information about casino games',
            type: ApplicationCommandOptionType.Boolean,
            required: false
        },
        {
            name: 'config',
            description: 'Show server casino configuration',
            type: ApplicationCommandOptionType.Boolean,
            required: false
        },
        {
            name: 'admin',
            description: 'Show administrator-only information (contains sensitive data)',
            type: ApplicationCommandOptionType.Boolean,
            required: false
        }
    ],
    dm_permission: false
};
export const options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false
};
const formatRTP = (rtp) => {
    if (typeof rtp === 'number') {
        return `- **RTP:** ${rtp.toFixed(2)}%`;
    }
    else {
        return ('- **RTPs:**\n' +
            Object.entries(rtp)
                .map(([key, value]) => `  - ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value.toFixed(2)}%`)
                .join('\n'));
    }
};
const formatBet = (label, value, symbol = '$') => {
    const parsedValue = parseFloat(value);
    return `- **${label}:** ${parsedValue === 0
        ? 'No Limit'
        : `${symbol}${formatNumberToReadableString(parsedValue)}`}`;
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
const formatMultipliers = (multipliers) => {
    if (typeof multipliers === 'number') {
        return `- **Multiplier:** ${formatNumberWithSpaces(multipliers)}x`;
    }
    const entries = Object.entries(multipliers);
    if (entries.length === 1) {
        const [, value] = entries[0];
        return `- **Multiplier:** ${formatNumberWithSpaces(value)}x`;
    }
    const lines = entries.map(([key, value]) => `  - ${key.charAt(0).toUpperCase() + key.slice(1)}: ${formatNumberWithSpaces(value)}x`);
    return `- **Multipliers:**\n${lines.join('\n')}`;
};
const renderSection = (title, baseLines, adminLines, isAdmin) => {
    const lines = [];
    if (isAdmin && adminLines?.length)
        lines.push(...adminLines);
    lines.push(...baseLines);
    return `## ${title}\n${lines.join('\n')}`;
};
export async function run({ interaction }) {
    const config = await getGuildConfigByGuildId({
        guildId: interaction.guildId
    });
    if (!config?.casinoSettings)
        return;
    const vipRooms = await getAllActiveVipsByGuildId({
        guildId: interaction.guildId
    });
    const vipChannelIds = vipRooms.map((room) => room.channelId);
    const settings = config.casinoSettings;
    const showGames = interaction.options.getBoolean('games') ?? false;
    const showConfig = interaction.options.getBoolean('config') ?? false;
    const showAdmin = interaction.options.getBoolean('admin') ?? false;
    if ((showGames && showConfig) || (!showGames && !showConfig)) {
        return interaction.reply({
            embeds: [
                createErrorEmbed('Error - Invalid selection', 'Please select **only one** section to view: either `games` or `config`.')
            ],
            flags: MessageFlags.Ephemeral
        });
    }
    if (showGames) {
        await interaction.reply({
            content: `# Casino Information\n${[
                renderSection('🎲 Dice', [
                    formatMultipliers(settings.dice.winMultiplier),
                    formatBet('Max Bet', settings.dice.maxBet),
                    formatBet('Min Bet', settings.dice.minBet)
                ], [formatRTP(calculateRTP('dice', settings.dice))], showAdmin),
                renderSection('🪙 Coin Flip', [
                    formatMultipliers(settings.coinflip.winMultiplier),
                    formatBet('Max Bet', settings.coinflip.maxBet),
                    formatBet('Min Bet', settings.coinflip.minBet)
                ], [formatRTP(calculateRTP('coinflip', settings.coinflip))], showAdmin),
                renderSection('🎰 Slots', [
                    formatMultipliers(settings.slots.winMultipliers),
                    formatBet('Max Bet', settings.slots.maxBet),
                    formatBet('Min Bet', settings.slots.minBet)
                ], [
                    formatRTP(calculateRTP('slots', settings.slots)),
                    `- **Symbol Weights:** \n${Object.entries(settings.slots.symbolWeights)
                        .map(([symbol, weight]) => `  - ${symbol}: ${weight}`)
                        .join('\n')}`
                ], showAdmin),
                renderSection('🎟️ Lottery', [
                    formatMultipliers(settings.lottery.winMultipliers),
                    formatBet('Max Bet', settings.lottery.maxBet),
                    formatBet('Min Bet', settings.lottery.minBet)
                ], [formatRTP(calculateRTP('lottery', settings.lottery))], showAdmin),
                renderSection('🌀 Roulette', [
                    formatMultipliers(settings.roulette.winMultipliers),
                    formatBet('Max Bet', settings.roulette.maxBet),
                    formatBet('Min Bet', settings.roulette.minBet)
                ], [formatRTP(calculateRTP('roulette', settings.roulette))], showAdmin),
                renderSection('🤑 Golden Jackpot', [
                    formatMultipliers(settings.goldenJackpot.winMultiplier),
                    formatBet('Max Bet', settings.goldenJackpot.maxBet),
                    formatBet('Min Bet', settings.goldenJackpot.minBet)
                ], [
                    formatRTP(calculateRTP('goldenJackpot', settings.goldenJackpot)),
                    `- **One in Chance:** 1 in ${formatNumberWithSpaces(settings.goldenJackpot.oneInChance)}`
                ], showAdmin),
                renderSection('🪨📄✂️ RPS', [
                    `- **Casino Cut:** ${settings.rps.casinoCut * 100}%`,
                    formatBet('Max Bet', settings.rps.maxBet),
                    formatBet('Min Bet', settings.rps.minBet)
                ], [formatRTP(calculateRTP('rps', settings.rps))], showAdmin),
                renderSection('🃏 Blackjack', [
                    formatBet('Max Bet', settings.blackjack.maxBet),
                    formatBet('Min Bet', settings.blackjack.minBet)
                ], [formatRTP(calculateRTP('blackjack', settings.blackjack))], showAdmin),
                renderSection('👀 Prediction', [
                    formatBet('Max Bet', settings.prediction.maxBet),
                    formatBet('Min Bet', settings.prediction.minBet)
                ])
            ].join('\n\n')}`
        });
    }
    if (showConfig) {
        await interaction.reply({
            content: renderSection('⚙️ Server Config', [
                formatRole('VIP Owner Role', config.vipSettings.roleOwnerId),
                formatRole('VIP Member Role', config.vipSettings.roleMemberId),
                formatBet('VIP Max Members', config.vipSettings.maxMembers, ''),
                `- **VIP Price Per Day:** ${config.vipSettings.pricePerDay === 0
                    ? 'Not Set'
                    : `$${formatNumberToReadableString(config.vipSettings.pricePerDay)}`}`,
                `- **VIP Create Price:** ${config.vipSettings.pricePerCreate === 0
                    ? 'Not Set'
                    : `$${formatNumberToReadableString(config.vipSettings.pricePerCreate)}`}`,
                '',
                formatRole('Manager Role', config.managerRoleId)
            ], [
                formatMultipleRooms('ATM Rooms', config.atmChannelIds),
                formatMultipleRooms('Prediction Rooms', config.predictionChannelIds),
                formatRooms('Gambling Rooms', config.casinoChannelIds),
                formatRooms('VIP Active Rooms', vipChannelIds),
                '',
                formatCategory('VIP Category', config.vipSettings.categoryId)
            ], showAdmin)
        });
    }
}
