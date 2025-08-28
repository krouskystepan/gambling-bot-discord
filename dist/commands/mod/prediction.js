"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const Prediction_1 = require("../../models/Prediction");
const createEmbed_1 = require("../../utils/createEmbed");
const User_1 = require("../../models/User");
const utils_1 = require("../../utils/utils");
exports.data = {
    name: 'prediction',
    description: 'Manage predictions.',
    options: [
        {
            name: 'create',
            description: 'Create a new prediction.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'title',
                    description: 'Title of the prediction',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: 'choices',
                    description: 'Comma-separated list of choices with odds (e.g. Yes:2,No:1.5,Maybe:3)',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            name: 'end',
            description: 'End an active prediction so no more bets can be placed.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'prediction-id',
                    description: 'ID of the prediction to end',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: true,
                },
            ],
        },
        {
            name: 'payout',
            description: 'Pay out winners of a prediction.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'prediction-id',
                    description: 'ID of the prediction to payout',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
                {
                    name: 'winner',
                    description: 'Name of the winning choice (full name)',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
            ],
        },
        {
            name: 'cancel',
            description: 'Cancel a prediction and refund all bets.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'prediction-id',
                    description: 'ID of the prediction to cancel',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
            ],
        },
    ],
    dm_permission: false,
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false,
};
async function run({ interaction }) {
    try {
        const configReply = await (0, utils_1.checkChannelConfiguration)(interaction, 'predictionChannelIds', {
            notSet: 'This server has not been configured for predictions yet.\nSet it up using `/setup-prediction`.',
            notAllowed: `This channel is not configured for prediction command.\nTry one of these channels:`,
        });
        if (!configReply)
            return;
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        if (subcommand === 'create') {
            const title = options.getString('title', true);
            const choicesInput = options.getString('choices', true);
            const rawChoices = choicesInput.split(',').map((c) => c.trim());
            if (rawChoices.length < 2 || rawChoices.length > 3) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Invalid Input - Wrong Number of Choices', 'You must provide **2 or 3 choices** only.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const choicesArray = [];
            for (const item of rawChoices) {
                const [name, odds] = item.split(':').map((x) => x.trim());
                if (!name || !odds || isNaN(Number(odds))) {
                    return interaction.reply({
                        embeds: [
                            (0, createEmbed_1.createErrorEmbed)('Invalid Input - Invalid Format', `Invalid option format: "${item}". Use OptionName:Odds (e.g. Yes:2)`),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                }
                choicesArray.push({
                    choiceName: name,
                    odds: Number(odds),
                    bets: [],
                });
            }
            await interaction.deferReply();
            const messageReply = (await interaction.fetchReply());
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(title)
                .setDescription(choicesArray
                .map((c) => `- **${c.choiceName}** — ${c.odds}x`)
                .join('\n'))
                .setFooter({ text: `ID: ${messageReply.id}` })
                .setColor(discord_js_1.Colors.Green)
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder();
            choicesArray.forEach((c) => {
                row.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`prediction.${messageReply.id}.${c.choiceName}.${c.odds}`)
                    .setLabel(c.choiceName)
                    .setStyle(discord_js_1.ButtonStyle.Primary));
            });
            await interaction.editReply({
                content: '**Status:** Active',
                embeds: [embed],
                components: [row],
            });
            await Prediction_1.default.create({
                predictionId: messageReply.id,
                guildId: interaction.guildId,
                channelId: interaction.channel?.id,
                creatorId: interaction.user.id,
                title,
                choices: choicesArray,
            });
        }
        if (subcommand === 'end') {
            const predictionId = options.getString('prediction-id', true);
            const prediction = await Prediction_1.default.findOne({ predictionId });
            if (!prediction) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Prediction Not Found', `No prediction found with ID: ${predictionId}`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (prediction.status !== 'active') {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Prediction is not active', `This prediction is already ${prediction.status}.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            prediction.status = 'ended';
            await prediction.save();
            const channel = await interaction.client.channels.fetch(prediction.channelId);
            if (!channel || !channel.isTextBased()) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Channel Not Found', 'Could not fetch the channel for this prediction.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const message = await channel.messages.fetch(prediction.predictionId);
            if (message) {
                const embed = message.embeds[0]?.toJSON() || {};
                const editedEmbed = {
                    ...embed,
                    color: discord_js_1.Colors.Orange,
                };
                await message.edit({
                    content: '**Status:** Ended',
                    embeds: [editedEmbed],
                    components: [],
                });
            }
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Prediction Ended', `Prediction **${prediction.title}** has ended.\n` +
                        `No more bets can be placed.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (subcommand === 'payout') {
            if (!configReply?.atmChannelIds.logs) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Error - Logs Not Set Up', 'ATM logs are not configured yet.\nPlease complete the setup.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const predictionId = options.getString('prediction-id', true);
            const winnerChoice = options.getString('winner', true);
            const prediction = await Prediction_1.default.findOne({ predictionId });
            if (!prediction) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Prediction Not Found', `No prediction found with ID: ${predictionId}`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (prediction.status !== 'ended') {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Prediction Not Ended', `You can only payout a prediction that has ended. Current status: ${prediction.status}`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const winner = prediction.choices.find((c) => c.choiceName === winnerChoice);
            if (!winner) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Invalid Choice', `The winner "${winnerChoice}" does not exist in this prediction.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            for (const bet of winner.bets) {
                await User_1.default.findOneAndUpdate({ userId: bet.userId, guildId: interaction.guildId }, { $inc: { balance: bet.amount * winner.odds } });
            }
            for (const bet of winner.bets) {
                await User_1.default.findOneAndUpdate({ userId: bet.userId, guildId: interaction.guildId }, { $inc: { balance: bet.amount * winner.odds } });
            }
            prediction.status = 'paid';
            await prediction.save();
            const logChannel = interaction.client.channels.cache.get(configReply.atmChannelIds.logs);
            if (!logChannel) {
                console.error('Log channel not found!');
            }
            else {
                const totalBets = prediction.choices.flatMap((c) => c.bets);
                const winners = winner.bets.map((b) => ({
                    userId: b.userId,
                    betAmount: b.amount,
                    winAmount: b.amount * winner.odds,
                }));
                const losers = prediction.choices
                    .filter((c) => c.choiceName !== winnerChoice)
                    .flatMap((c) => c.bets.map((b) => ({
                    userId: b.userId,
                    betAmount: b.amount,
                    winAmount: 0,
                })));
                const totalWon = winners.reduce((acc, w) => acc + w.winAmount, 0);
                const totalLost = losers.reduce((acc, l) => acc + l.betAmount, 0);
                const casinoProfit = totalLost - totalWon;
                const winnersDisplay = await Promise.all(winners.map(async (w) => {
                    const member = await interaction.guild?.members
                        .fetch(w.userId)
                        .catch(() => null);
                    const username = member ? `<@${member.id}>` : 'Unknown';
                    return `${username} (Bet: $${(0, utils_1.formatNumberToReadableString)(w.betAmount)}, Win: $${(0, utils_1.formatNumberToReadableString)(w.winAmount)})`;
                }));
                const losersDisplay = await Promise.all(losers.map(async (l) => {
                    const member = await interaction.guild?.members
                        .fetch(l.userId)
                        .catch(() => null);
                    const username = member ? `<@${member.id}>` : 'Unknown';
                    return `${username} (Bet: $${(0, utils_1.formatNumberToReadableString)(l.betAmount)}, Win: $0)`;
                }));
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(`Prediction Payout - ${prediction.title}`)
                    .setColor(casinoProfit >= 0 ? discord_js_1.Colors.Green : discord_js_1.Colors.Red)
                    .addFields({
                    name: 'Participants',
                    value: `${totalBets.length}`,
                    inline: true,
                }, { name: 'Winners', value: `${winners.length}`, inline: true }, { name: 'Losers', value: `${losers.length}`, inline: true }, {
                    name: 'Casino Profit/Loss',
                    value: `$${(0, utils_1.formatNumberToReadableString)(casinoProfit)}`,
                    inline: true,
                }, {
                    name: 'Winners Detail',
                    value: winnersDisplay.join('\n') || 'None',
                }, { name: 'Losers Detail', value: losersDisplay.join('\n') || 'None' });
                logChannel.send({ embeds: [embed] }).catch(console.error);
            }
            const channel = await interaction.client.channels.fetch(prediction.channelId);
            if (channel?.isTextBased()) {
                const message = await channel.messages.fetch(prediction.predictionId);
                if (message) {
                    const embed = message.embeds[0]?.toJSON() || {};
                    const editedEmbed = {
                        ...embed,
                        color: discord_js_1.Colors.DarkGreen,
                        title: embed.title,
                    };
                    await message.edit({
                        content: `**Status:** Paid (Winner: ${winnerChoice})`,
                        embeds: [editedEmbed],
                        components: [],
                    });
                }
            }
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Winners Paid', `All users who bet on **${winnerChoice}** have been paid.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (subcommand === 'cancel') {
            const predictionId = options.getString('prediction-id', true);
            const prediction = await Prediction_1.default.findOne({ predictionId });
            if (!prediction) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Prediction Not Found', `No prediction found with ID: ${predictionId}`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const allBets = prediction.choices.flatMap((c) => c.bets);
            for (const bet of allBets) {
                await User_1.default.findOneAndUpdate({ userId: bet.userId, guildId: interaction.guildId }, { $inc: { balance: bet.amount } });
            }
            prediction.status = 'canceled';
            await prediction.save();
            const channel = await interaction.client.channels.fetch(prediction.channelId);
            if (channel?.isTextBased()) {
                const message = await channel.messages.fetch(prediction.predictionId);
                if (message) {
                    const embed = message.embeds[0]?.toJSON() || {};
                    const editedEmbed = {
                        ...embed,
                        color: 0x9b59b6,
                        title: `${embed.title}`,
                    };
                    await message.edit({
                        content: '**Status:** Canceled — All bets refunded',
                        embeds: [editedEmbed],
                        components: [],
                    });
                }
            }
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('Prediction Canceled', `All bets for **${prediction.title}** have been refunded.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
