"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../../utils/createEmbed");
const blackjackUtils_1 = require("../../../../utils/blackjackUtils");
const BlackjackGame_1 = require("../../../../models/BlackjackGame");
const casinoHelpers_1 = require("../../../../utils/casinoHelpers");
const utils_1 = require("../../../../utils/utils");
exports.data = {
    name: 'blackjack',
    description: 'Start a game of blackjack. You can hit, stand, or double down.',
    options: [
        {
            name: 'bet',
            description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'show-balance',
            description: 'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
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
        const existingGame = await BlackjackGame_1.default.findOne({
            guildId: interaction.guild?.id,
            userId: interaction.user.id,
        });
        if (existingGame) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Blackjack Already Active', `You already have an active Blackjack game running! 🃏`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const betAmount = interaction.options.getString('bet', true);
        const parsedBetAmount = (0, utils_1.parseReadableStringToNumber)(betAmount);
        const readableBetAmount = (0, utils_1.formatNumberToReadableString)(parsedBetAmount);
        const showBalance = interaction.options.getBoolean('show-balance') || false;
        const isBetValid = (0, utils_1.checkValidBet)(interaction, parsedBetAmount, configReply.casinoSettings.blackjack.maxBet, configReply.casinoSettings.blackjack.minBet, user.balance);
        if (!isBetValid)
            return;
        await interaction.deferReply();
        user.balance -= parsedBetAmount;
        user.amountGambled += parsedBetAmount;
        user.milestoneProgress += parsedBetAmount;
        await user.save();
        const shuffledDeck = (0, blackjackUtils_1.shuffleDeck)(blackjackUtils_1.DECK);
        const playerCards = [
            (0, casinoHelpers_1.drawNextCard)(shuffledDeck, 0),
            (0, casinoHelpers_1.drawNextCard)(shuffledDeck, 1),
        ];
        const dealerCards = [
            (0, casinoHelpers_1.drawNextCard)(shuffledDeck, 2),
            (0, casinoHelpers_1.drawNextCard)(shuffledDeck, 3),
        ];
        const playerTotal = (0, blackjackUtils_1.calculateHandValue)(playerCards);
        const dealerTotal = (0, blackjackUtils_1.calculateHandValue)(dealerCards);
        const playerHasBlackjack = playerCards.length === 2 && playerTotal === 21;
        const dealerHasBlackjack = dealerCards.length === 2 && dealerTotal === 21;
        let resultId;
        if (playerHasBlackjack || dealerHasBlackjack) {
            if (playerHasBlackjack && dealerHasBlackjack) {
                resultId = 'BBJ';
                user.balance += parsedBetAmount;
            }
            else if (playerHasBlackjack) {
                user.balance += parsedBetAmount * 2.5;
                resultId = 'PBJ';
            }
            else if (dealerHasBlackjack) {
                resultId = 'DBJ';
            }
            await user.save();
            return interaction.editReply({
                embeds: [
                    (0, blackjackUtils_1.createBlackjackEmbed)(readableBetAmount, dealerCards, dealerTotal, playerCards, playerTotal, resultId, showBalance, user.balance),
                ],
            });
            //  await checkMilestones(interaction, user, interaction.guildId!)
        }
        const message = await interaction.fetchReply();
        const game = new BlackjackGame_1.default({
            gameId: message.id,
            userId: interaction.user.id,
            guildId: interaction.guildId,
            betAmount: parsedBetAmount,
            deck: shuffledDeck,
            playerCards,
            dealerCards,
        });
        await game.save();
        const hitButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`blackjack.${message.id}-${interaction.user.id}-${interaction.guildId}.hit.${showBalance}`)
            .setLabel('Hit')
            .setStyle(discord_js_1.ButtonStyle.Success);
        const standButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`blackjack.${message.id}-${interaction.user.id}-${interaction.guildId}.stand.${showBalance}`)
            .setLabel('Stand')
            .setStyle(discord_js_1.ButtonStyle.Danger);
        const doubleButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`blackjack.${message.id}-${interaction.user.id}-${interaction.guildId}.double.${showBalance}`)
            .setLabel('Double')
            .setStyle(discord_js_1.ButtonStyle.Primary);
        const row = new discord_js_1.ActionRowBuilder().addComponents(hitButton, standButton, doubleButton);
        interaction.editReply({
            embeds: [
                (0, blackjackUtils_1.createBlackjackEmbed)(readableBetAmount, dealerCards, dealerTotal, playerCards, playerTotal, undefined, false, 0, true),
            ],
            components: [row],
        });
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
