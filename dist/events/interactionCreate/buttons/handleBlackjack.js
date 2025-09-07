"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const User_1 = require("../../../models/User");
const BlackjackGame_1 = require("../../../models/BlackjackGame");
const blackjackUtils_1 = require("../../../utils/blackjackUtils");
const casinoHelpers_1 = require("../../../utils/casinoHelpers");
const createEmbed_1 = require("../../../utils/createEmbed");
const utils_1 = require("../../../utils/utils");
exports.default = async (interaction, client) => {
    if (!interaction.isButton() || !interaction.customId)
        return;
    try {
        const [type, ids, action, showBalanceString] = interaction.customId.split('.');
        if (!type || !ids || !action)
            return;
        const [gameId, userId, guildId] = ids.split('-');
        if (type !== 'blackjack')
            return;
        if (!gameId || !userId || !guildId)
            return;
        const showBalance = showBalanceString === 'true';
        if (userId !== interaction.user.id) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Wrong user', 'This is not your game.\nStart your own with `/blackjack`.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const game = await BlackjackGame_1.default.findOne({ userId, guildId, gameId });
        if (!game) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Game not found', 'You do not have an active game.\nStart one with `/blackjack`.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const message = await interaction.channel?.messages.fetch(gameId);
        if (!message) {
            await BlackjackGame_1.default.findOneAndDelete({ userId, guildId, gameId });
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Message not found', 'The message for this game was not found.\nStart a new game with `/blackjack`.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (action === 'stand') {
            await interaction.deferUpdate();
            const deck = [...game.deck];
            let dealerCards = [...game.dealerCards];
            const playerCards = [...game.playerCards];
            let dealerTotal = (0, blackjackUtils_1.calculateHandValue)(dealerCards);
            const playerTotal = (0, blackjackUtils_1.calculateHandValue)(playerCards);
            let gameIndex = game.dealerCards.length + game.playerCards.length;
            const user = await User_1.default.findOne({ userId, guildId });
            if (!user)
                return;
            await (0, blackjackUtils_1.revealDealerCards)((0, utils_1.formatNumberToReadableString)(game.betAmount), message, dealerCards, dealerTotal, playerCards, playerTotal, deck, gameIndex, user, guildId, gameId, showBalance);
            return interaction.followUp({
                content: 'You have stood.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (action === 'hit') {
            await interaction.deferUpdate();
            const dealerCards = [...game.dealerCards];
            const dealerTotal = (0, blackjackUtils_1.calculateHandValue)(dealerCards);
            let playerTotal = (0, blackjackUtils_1.calculateHandValue)(game.playerCards);
            let gameIndex = game.dealerCards.length + game.playerCards.length;
            if (game.playerCards.length <= 3) {
                const hitButton = new discord_js_1.ButtonBuilder()
                    .setCustomId(`blackjack.${gameId}-${userId}-${guildId}.hit.${showBalance}`)
                    .setLabel('Hit')
                    .setStyle(discord_js_1.ButtonStyle.Success);
                const standButton = new discord_js_1.ButtonBuilder()
                    .setCustomId(`blackjack.${gameId}-${userId}-${guildId}.stand.${showBalance}`)
                    .setLabel('Stand')
                    .setStyle(discord_js_1.ButtonStyle.Danger);
                const row = new discord_js_1.ActionRowBuilder().addComponents(hitButton, standButton);
                await message.edit({
                    components: [row],
                });
            }
            const drawnCard = (0, casinoHelpers_1.drawNextCard)(game.deck, gameIndex);
            game.playerCards.push(drawnCard);
            playerTotal = (0, blackjackUtils_1.calculateHandValue)(game.playerCards);
            const user = await User_1.default.findOne({ userId, guildId });
            if (!user)
                return;
            if (playerTotal > 21) {
                await message.edit({
                    embeds: [
                        (0, blackjackUtils_1.createBlackjackEmbed)((0, utils_1.formatNumberToReadableString)(game.betAmount), dealerCards, dealerTotal, game.playerCards, playerTotal, 'PB', showBalance, user.balance),
                    ],
                    components: [],
                });
                await BlackjackGame_1.default.findOneAndDelete({ userId, guildId, gameId });
                return interaction.followUp({
                    content: 'You have busted.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (playerTotal === 21) {
                await (0, blackjackUtils_1.revealDealerCards)((0, utils_1.formatNumberToReadableString)(game.betAmount), message, dealerCards, dealerTotal, game.playerCards, playerTotal, game.deck, gameIndex + 1, user, guildId, gameId, showBalance);
                await BlackjackGame_1.default.findOneAndDelete({ userId, guildId, gameId });
                return interaction.followUp({
                    content: 'You have hit.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            await BlackjackGame_1.default.findOneAndUpdate({ userId, guildId, gameId }, { playerCards: game.playerCards, deck: game.deck });
            await message.edit({
                embeds: [
                    (0, blackjackUtils_1.createBlackjackEmbed)((0, utils_1.formatNumberToReadableString)(game.betAmount), dealerCards, dealerTotal, game.playerCards, playerTotal, undefined, false, 0, true),
                ],
            });
            return interaction.followUp({
                content: 'You have hit.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (action === 'double') {
            await interaction.deferUpdate();
            const dealerCards = [...game.dealerCards];
            const dealerTotal = (0, blackjackUtils_1.calculateHandValue)(dealerCards);
            let playerTotal = (0, blackjackUtils_1.calculateHandValue)(game.playerCards);
            let gameIndex = game.dealerCards.length + game.playerCards.length;
            const user = await User_1.default.findOne({ userId, guildId });
            const betAmount = game.betAmount * 2;
            if (!user)
                return;
            if (betAmount > user.balance) {
                return interaction.followUp({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Insufficient balance', `You don't have enough money to place this bet.\nYour current balance is **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            user.balance -= game.betAmount;
            await user.save();
            const drawnCard = (0, casinoHelpers_1.drawNextCard)(game.deck, gameIndex);
            game.playerCards.push(drawnCard);
            playerTotal = (0, blackjackUtils_1.calculateHandValue)(game.playerCards);
            if (playerTotal > 21) {
                await BlackjackGame_1.default.findOneAndDelete({ userId, guildId, gameId });
                await message.edit({
                    embeds: [
                        (0, blackjackUtils_1.createBlackjackEmbed)((0, utils_1.formatNumberToReadableString)(betAmount), dealerCards, dealerTotal, game.playerCards, playerTotal, 'PB', showBalance, user.balance),
                    ],
                    components: [],
                });
                return interaction.followUp({
                    content: 'You have busted.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            await (0, blackjackUtils_1.revealDealerCards)((0, utils_1.formatNumberToReadableString)(betAmount), message, dealerCards, dealerTotal, game.playerCards, playerTotal, game.deck, gameIndex + 1, user, guildId, gameId, showBalance);
            return interaction.followUp({
                content: 'You have doubled down.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
    catch (error) {
        console.error('Error in handleBlackjack.ts', error);
    }
};
