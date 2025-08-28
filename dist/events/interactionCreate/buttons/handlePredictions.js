"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const User_1 = require("../../../models/User");
const Prediction_1 = require("../../../models/Prediction");
const createEmbed_1 = require("../../../utils/createEmbed");
const utils_1 = require("../../../utils/utils");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
exports.default = async (interaction) => {
    if (!interaction.isButton() || !interaction.customId)
        return;
    try {
        const [type, predictionId, choiceName, odds] = interaction.customId.split('.');
        if (type !== 'prediction' || !predictionId || !choiceName || !odds)
            return;
        const targetPrediction = await Prediction_1.default.findOne({
            predictionId,
            guildId: interaction.guildId,
        });
        if (!targetPrediction || !interaction.channel)
            return;
        if (targetPrediction.status !== 'active') {
            return await interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Not active', 'This prediction is not active.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const modal = new discord_js_1.ModalBuilder()
            .setTitle(`Place your bet on ${choiceName}.`)
            .setCustomId(`prediction-${predictionId}-${choiceName}-${interaction.user.id}`);
        const textInput = new discord_js_1.TextInputBuilder()
            .setCustomId(`bet-${predictionId}-input-${interaction.user.id}`)
            .setLabel('How much would you like to bet?')
            .setPlaceholder('e.g. 1000, 4k, 10.5k')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true);
        modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(textInput));
        await interaction.showModal(modal);
        const modalInteraction = await interaction
            .awaitModalSubmit({
            filter: (i) => i.customId.startsWith(`prediction-${predictionId}-${choiceName}`) &&
                i.user.id === interaction.user.id,
            time: 60000,
        })
            .catch(() => null);
        if (!modalInteraction)
            return;
        await modalInteraction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const betAmount = modalInteraction.fields.getTextInputValue(`bet-${predictionId}-input-${modalInteraction.user.id}`);
        const parsedBetAmount = (0, utils_1.parseReadableStringToNumber)(betAmount);
        if (isNaN(parsedBetAmount) || parsedBetAmount <= 0) {
            return modalInteraction.editReply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input', 'Please enter a valid positive number.'),
                ],
            });
        }
        const guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        const casinoSettings = guildConfiguration?.casinoSettings;
        if (!casinoSettings)
            return;
        if (casinoSettings.prediction.maxBet > 0 &&
            parsedBetAmount > casinoSettings.prediction.maxBet) {
            return modalInteraction.editReply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Above Maximum Bet', `The maximum bet is **$${(0, utils_1.formatNumberToReadableString)(casinoSettings.prediction.maxBet)}**.`),
                ],
            });
        }
        if (casinoSettings.prediction.minBet > 0 &&
            parsedBetAmount < casinoSettings.prediction.minBet) {
            return modalInteraction.editReply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Below Minimum Bet', `The minimum bet is **$${(0, utils_1.formatNumberToReadableString)(casinoSettings.prediction.minBet)}**.`),
                ],
            });
        }
        const updatedUser = await User_1.default.findOneAndUpdate({
            userId: modalInteraction.user.id,
            guildId: modalInteraction.guildId,
            balance: { $gte: parsedBetAmount },
        }, { $inc: { balance: -parsedBetAmount } }, { new: true });
        if (!updatedUser) {
            return modalInteraction.editReply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Insufficient Funds', `You don't have enough money to place this bet.`),
                ],
            });
        }
        await Prediction_1.default.findOneAndUpdate({
            predictionId,
            guildId: modalInteraction.guildId,
            'choices.choiceName': choiceName,
        }, {
            $push: {
                'choices.$.bets': {
                    userId: modalInteraction.user.id,
                    amount: parsedBetAmount,
                },
            },
        });
        await modalInteraction.editReply({
            embeds: [
                (0, createEmbed_1.createSuccessEmbed)('Bet Placed Successfully', `You placed **$${(0, utils_1.formatNumberToReadableString)(parsedBetAmount)}** on **${choiceName}**`),
            ],
        });
    }
    catch (error) {
        console.error('Error in handlePrediction.ts', error);
    }
};
