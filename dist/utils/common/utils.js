import { MessageFlags } from 'discord.js';
import { createInfoEmbed } from '../discord/createEmbed';
export const generateBetId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.floor(Math.random() * 1_000_000)
        .toString(36)
        .padStart(5, '0');
    return `${timestamp}${random}`.toUpperCase();
};
export const formatNumberToReadableString = (number) => {
    const absNumber = Math.abs(number);
    const roundTo = (num, digits = 2) => Math.round(num * 10 ** digits) / 10 ** digits;
    let formatted;
    if (absNumber >= 1_000_000_000) {
        formatted = `${roundTo(absNumber / 1_000_000_000)}B`;
    }
    else if (absNumber >= 1_000_000) {
        formatted = `${roundTo(absNumber / 1_000_000)}M`;
    }
    else if (absNumber >= 1_000) {
        formatted = `${roundTo(absNumber / 1_000)}k`;
    }
    else {
        formatted = roundTo(absNumber).toString();
    }
    return number < 0 ? `-${formatted}` : formatted;
};
export const parseReadableStringToNumber = (readableString) => {
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
export const formatNumberWithSpaces = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
export const formatNumberToPercentage = (num) => {
    return (num * 100).toFixed(2) + '%';
};
export const parseTimeToSeconds = (time) => {
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
export const checkValidBet = (interaction, betAmount, maxBet, minBet, userBalance, xTimes) => {
    if (isNaN(betAmount)) {
        interaction.reply({
            embeds: [
                createInfoEmbed('Invalid Input - Not a number', 'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.')
            ],
            flags: MessageFlags.Ephemeral
        });
        return false;
    }
    if (betAmount <= 0) {
        interaction.reply({
            embeds: [
                createInfoEmbed('Invalid Input - Non-positive number', 'The number you provided must be greater than 0.\nPlease enter a positive value.')
            ],
            flags: MessageFlags.Ephemeral
        });
        return false;
    }
    if (maxBet > 0 && betAmount > maxBet) {
        interaction.reply({
            embeds: [
                createInfoEmbed('Invalid Input - Above Maximum Bet', `The maximum bet is **$${formatNumberToReadableString(maxBet)}**.`)
            ],
            flags: MessageFlags.Ephemeral
        });
        return false;
    }
    if (minBet > 0 && betAmount < minBet) {
        interaction.reply({
            embeds: [
                createInfoEmbed('Invalid Input - Below Minimum Bet', `The minimum bet is **$${formatNumberToReadableString(minBet)}**.`)
            ],
            flags: MessageFlags.Ephemeral
        });
        return false;
    }
    if (userBalance < betAmount) {
        interaction.reply({
            embeds: [
                createInfoEmbed('Insufficient Funds', `You don't have enough money to place this bet.\nYour current balance is **$${formatNumberToReadableString(userBalance)}**.`)
            ],
            flags: MessageFlags.Ephemeral
        });
        return false;
    }
    if (xTimes) {
        const totalBet = xTimes * betAmount;
        if (userBalance < totalBet) {
            interaction.reply({
                embeds: [
                    createInfoEmbed('Insufficient Funds', `You don't have enough money to place this bet for ${xTimes} spins (you need **$${formatNumberToReadableString(totalBet)}**).\nYour current balance is **$${formatNumberToReadableString(userBalance)}**.`)
                ],
                flags: MessageFlags.Ephemeral
            });
            return false;
        }
    }
    return true;
};
