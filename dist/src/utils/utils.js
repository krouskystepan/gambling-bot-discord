"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkValidBet = exports.parseTimeToSeconds = exports.formatNumberToPercentage = exports.formatNumberWithSpaces = exports.parseReadableStringToNumber = exports.formatNumberToReadableString = exports.checkUserRegistration = exports.checkChannelConfiguration = exports.connectToDatabase = void 0;
exports.checkMilestones = checkMilestones;
const mongoose_1 = require("mongoose");
const GuildConfiguration_1 = require("../models/GuildConfiguration");
const discord_js_1 = require("discord.js");
const User_1 = require("../models//User");
const createEmbed_1 = require("./createEmbed");
const defaultConfig_1 = require("./defaultConfig");
const VipRoom_1 = require("../models/VipRoom");
const Milestone_1 = require("../models/Milestone");
const connectToDatabase = async () => {
    try {
        if (!process.env.MONGO_URI)
            throw new Error('MONGO_URI is not defined');
        mongoose_1.default.set('strictQuery', false);
        await mongoose_1.default.connect(process.env.MONGO_URI);
        console.log('✅ Connected to the database');
    }
    catch (error) {
        console.error('Error connecting to the database:', error);
    }
};
exports.connectToDatabase = connectToDatabase;
const checkChannelConfiguration = async (interaction, channelType, messages) => {
    try {
        let guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration) {
            guildConfiguration = new GuildConfiguration_1.default({
                guildId: interaction.guildId,
                casinoSettings: defaultConfig_1.default,
            });
            await guildConfiguration.save();
        }
        else if (!guildConfiguration.casinoSettings) {
            guildConfiguration.casinoSettings = defaultConfig_1.default;
            await guildConfiguration.save();
        }
        let allowedChannelIds = [];
        if (channelType === 'predictionChannelIds') {
            const actionsChannel = guildConfiguration.predictionChannelIds.actions;
            const logsChannel = guildConfiguration.predictionChannelIds.logs;
            if (!actionsChannel || !logsChannel) {
                await interaction.reply({
                    embeds: [(0, createEmbed_1.createErrorEmbed)('Error - Not Configured', messages.notSet)],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return false;
            }
            allowedChannelIds = [actionsChannel];
        }
        else if (channelType === 'transactionChannelId') {
            allowedChannelIds = guildConfiguration.transactionChannelId
                ? [guildConfiguration.transactionChannelId]
                : [];
        }
        else {
            allowedChannelIds = guildConfiguration[channelType] || [];
        }
        if (channelType === 'casinoChannelIds') {
            const activeVipRooms = await VipRoom_1.default.find({
                guildId: interaction.guildId,
                expiresAt: { $gt: new Date() },
            });
            allowedChannelIds = allowedChannelIds.concat(activeVipRooms.map((vip) => vip.channelId));
        }
        if (!allowedChannelIds.length) {
            await interaction.reply({
                embeds: [(0, createEmbed_1.createErrorEmbed)('Error - Not Configured', messages.notSet)],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return false;
        }
        if (!allowedChannelIds.includes(interaction.channelId)) {
            await interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Incorrect Channel', `${messages.notAllowed} ${allowedChannelIds
                        .map((id) => `<#${id}>`)
                        .join(', ')}.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return false;
        }
        return guildConfiguration;
    }
    catch (error) {
        console.error('Error checking channel configuration:', error);
        return false;
    }
};
exports.checkChannelConfiguration = checkChannelConfiguration;
const checkUserRegistration = async (userId, guildId) => {
    return await User_1.default.findOne({ userId, guildId });
};
exports.checkUserRegistration = checkUserRegistration;
const formatNumberToReadableString = (number) => {
    const absNumber = Math.abs(number);
    let formatted;
    if (absNumber >= 1_000_000_000) {
        formatted =
            (absNumber / 1_000_000_000).toFixed(absNumber % 1_000_000_000 === 0 ? 0 : 2) + 'B';
    }
    else if (absNumber >= 1_000_000) {
        formatted =
            (absNumber / 1_000_000).toFixed(absNumber % 1_000_000 === 0 ? 0 : 2) + 'M';
    }
    else if (absNumber >= 1_000) {
        formatted =
            (absNumber / 1_000).toFixed(absNumber % 1_000 === 0 ? 0 : 2) + 'k';
    }
    else {
        formatted = absNumber.toString();
    }
    return number < 0 ? `-${formatted}` : formatted;
};
exports.formatNumberToReadableString = formatNumberToReadableString;
const parseReadableStringToNumber = (readableString) => {
    const normalizedString = readableString.toUpperCase();
    if (!/^[-]?[0-9.]+[BMK]?$/.test(normalizedString)) {
        return NaN;
    }
    if (normalizedString.endsWith('B')) {
        return parseFloat(normalizedString.slice(0, -1)) * 1_000_000_000;
    }
    else if (normalizedString.endsWith('M')) {
        return parseFloat(normalizedString.slice(0, -1)) * 1_000_000;
    }
    else if (normalizedString.endsWith('K')) {
        return parseFloat(normalizedString.slice(0, -1)) * 1_000;
    }
    else {
        return parseFloat(normalizedString);
    }
};
exports.parseReadableStringToNumber = parseReadableStringToNumber;
const formatNumberWithSpaces = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
exports.formatNumberWithSpaces = formatNumberWithSpaces;
const formatNumberToPercentage = (num) => {
    return (num * 100).toFixed(2) + '%';
};
exports.formatNumberToPercentage = formatNumberToPercentage;
const parseTimeToSeconds = (time) => {
    const regex = /(\d+)([hdw])/gi;
    let totalSeconds = 0;
    const sanitizedTime = time.replace(/\s+/g, '');
    const matches = sanitizedTime.match(regex);
    if (matches) {
        matches.forEach((match) => {
            const value = parseInt(match.slice(0, -1), 10);
            const unit = match.slice(-1).toLowerCase();
            switch (unit) {
                case 'h':
                    totalSeconds += value * 3600;
                    break;
                case 'd':
                    totalSeconds += value * 86400;
                    break;
                case 'w':
                    totalSeconds += value * 604800;
                    break;
            }
        });
    }
    return totalSeconds;
};
exports.parseTimeToSeconds = parseTimeToSeconds;
const checkValidBet = (interaction, betAmount, maxBet, minBet, userBalance, xTimes) => {
    if (isNaN(betAmount)) {
        interaction.reply({
            embeds: [
                (0, createEmbed_1.createInfoEmbed)('Invalid Input - Not a number', 'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return false;
    }
    if (betAmount <= 0) {
        interaction.reply({
            embeds: [
                (0, createEmbed_1.createInfoEmbed)('Invalid Input - Non-positive number', 'The number you provided must be greater than 0.\nPlease enter a positive value.'),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return false;
    }
    if (maxBet > 0 && betAmount > maxBet) {
        interaction.reply({
            embeds: [
                (0, createEmbed_1.createInfoEmbed)('Invalid Input - Above Maximum Bet', `The maximum bet is **$${(0, exports.formatNumberToReadableString)(maxBet)}**.`),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return false;
    }
    if (minBet > 0 && betAmount < minBet) {
        interaction.reply({
            embeds: [
                (0, createEmbed_1.createInfoEmbed)('Invalid Input - Below Minimum Bet', `The minimum bet is **$${(0, exports.formatNumberToReadableString)(minBet)}**.`),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return false;
    }
    if (userBalance < betAmount) {
        interaction.reply({
            embeds: [
                (0, createEmbed_1.createInfoEmbed)('Insufficient Funds', `You don't have enough money to place this bet.\nYour current balance is **$${(0, exports.formatNumberToReadableString)(userBalance)}**.`),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return false;
    }
    if (xTimes) {
        const totalBet = xTimes * betAmount;
        if (userBalance < totalBet) {
            interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Insufficient Funds', `You don't have enough money to place this bet for ${xTimes} spins (you need **$${(0, exports.formatNumberToReadableString)(totalBet)}**).\nYour current balance is **$${(0, exports.formatNumberToReadableString)(userBalance)}**.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return false;
        }
    }
    return true;
};
exports.checkValidBet = checkValidBet;
async function checkMilestones(interaction, user, guildId) {
    const guildConf = await GuildConfiguration_1.default.findOne({ guildId });
    if (!guildConf)
        return;
    const guildMilestonesDoc = await Milestone_1.default.findOne({ guildId });
    if (!guildMilestonesDoc)
        return;
    const { baseThreshold, baseReward, multiplierThreshold, multiplierReward } = guildMilestonesDoc;
    const milestones = [];
    let threshold = baseThreshold;
    let reward = baseReward;
    while (threshold <= 1_000_000_000) {
        milestones.push({ threshold, reward });
        threshold = Math.floor(threshold * multiplierThreshold);
        reward = Math.floor(reward * multiplierReward);
    }
    let lastUnlocked = user.milestoneUnlocked ?? 0;
    const unlocked = [];
    for (const m of milestones) {
        if (m.threshold > lastUnlocked) {
            const progress = user.amountGambled - lastUnlocked;
            if (progress >= m.threshold - lastUnlocked) {
                unlocked.push(m);
                lastUnlocked = m.threshold;
            }
            break;
        }
    }
    if (unlocked.length) {
        const totalReward = unlocked.reduce((sum, m) => sum + m.reward, 0);
        user.milestoneUnlocked = lastUnlocked;
        user.balance += totalReward;
        await user.save();
        const milestoneMessages = unlocked
            .map((m) => `🎉 Unlocked milestone **${(0, exports.formatNumberToReadableString)(m.threshold)}** → +**$${(0, exports.formatNumberToReadableString)(m.reward)}**`)
            .join('\n');
        if (interaction.isChatInputCommand() ||
            interaction.isButton() ||
            interaction.isStringSelectMenu() ||
            interaction.isUserSelectMenu() ||
            interaction.isRoleSelectMenu() ||
            interaction.isMentionableSelectMenu() ||
            interaction.isChannelSelectMenu()) {
            await interaction.followUp({
                content: `💎 You unlocked new milestones!\n${milestoneMessages}`,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        // Transaction channel
        if (guildConf.transactionChannelId) {
            const channel = interaction.guild?.channels.cache.get(guildConf.transactionChannelId);
            if (channel?.isTextBased()) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('ATM - Milestone Unlocked!')
                    .setColor('Orange')
                    .setDescription(`User <@${user.userId}> just unlocked the following milestone(s):`)
                    .addFields(unlocked.map((m) => ({
                    name: `Threshold: ${(0, exports.formatNumberToReadableString)(m.threshold)}`,
                    value: `Reward: 💰 ${(0, exports.formatNumberToReadableString)(m.reward)}`,
                    inline: true,
                })))
                    .setTimestamp();
                await channel.send({ embeds: [embed] }).catch(console.error);
            }
        }
    }
    else {
        await user.save();
    }
}
