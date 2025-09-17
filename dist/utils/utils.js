"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkValidBet = exports.parseTimeToSeconds = exports.formatNumberToPercentage = exports.formatNumberWithSpaces = exports.parseReadableStringToNumber = exports.formatNumberToReadableString = exports.checkUserRegistration = exports.checkChannelConfiguration = exports.generateBetId = exports.connectToDatabase = void 0;
const mongoose_1 = require("mongoose");
const GuildConfiguration_1 = require("../models/GuildConfiguration");
const discord_js_1 = require("discord.js");
const User_1 = require("../models//User");
const createEmbed_1 = require("./createEmbed");
const defaultConfig_1 = require("./defaultConfig");
const VipRoom_1 = require("../models/VipRoom");
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
const generateBetId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.floor(Math.random() * 1_000_000)
        .toString(36)
        .padStart(5, '0');
    return `${timestamp}${random}`.toUpperCase();
};
exports.generateBetId = generateBetId;
const checkChannelConfiguration = async (interaction, channelType, messages) => {
    try {
        let guildConfig = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfig) {
            guildConfig = new GuildConfiguration_1.default({
                guildId: interaction.guildId,
                casinoSettings: defaultConfig_1.default,
            });
            await guildConfig.save();
        }
        else if (!guildConfig.casinoSettings) {
            guildConfig.casinoSettings = defaultConfig_1.default;
            await guildConfig.save();
        }
        let allowedChannelIds = [];
        if (channelType === 'predictionChannelIds') {
            const { actions, logs } = guildConfig.predictionChannelIds || {};
            if (!actions || !logs) {
                await interaction.reply({
                    embeds: [(0, createEmbed_1.createErrorEmbed)('Error - Not Configured', messages.notSet)],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return false;
            }
            allowedChannelIds = [actions];
        }
        else if (channelType === 'atmChannelIds') {
            const logsChannel = guildConfig.atmChannelIds?.logs;
            if (!logsChannel) {
                await interaction.reply({
                    embeds: [(0, createEmbed_1.createErrorEmbed)('Error - Not Configured', messages.notSet)],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return false;
            }
            allowedChannelIds = [logsChannel];
        }
        else {
            allowedChannelIds = guildConfig[channelType] || [];
            if (channelType === 'casinoChannelIds') {
                const activeVipRooms = await VipRoom_1.default.find({
                    guildId: interaction.guildId,
                    expiresAt: { $gt: new Date() },
                });
                allowedChannelIds.push(...activeVipRooms.map((vip) => vip.channelId));
            }
        }
        if (!allowedChannelIds.length) {
            await interaction.reply({
                embeds: [(0, createEmbed_1.createErrorEmbed)('Error - Not Configured', messages.notSet)],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return false;
        }
        if (!allowedChannelIds.includes(interaction.channelId)) {
            const allowedMentions = allowedChannelIds
                .map((id) => `<#${id}>`)
                .join(', ');
            await interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Incorrect Channel', `${messages.notAllowed} ${allowedMentions}.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return false;
        }
        return guildConfig;
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
