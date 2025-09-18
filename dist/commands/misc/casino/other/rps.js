"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../../utils/createEmbed");
const utils_1 = require("../../../../utils/utils");
const Transaction_1 = require("../../../../models/Transaction");
const User_1 = require("../../../../models/User");
const choices = [
    { name: 'rock', emoji: '🪨', beats: 'scissors' },
    { name: 'scissors', emoji: '✂️', beats: 'paper' },
    { name: 'paper', emoji: '📄', beats: 'rock' },
];
exports.data = {
    name: 'rps',
    description: 'Play rock, paper, scissors with another user.',
    options: [
        {
            name: 'player',
            description: 'The user you want to play against.',
            type: discord_js_1.ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: 'bet',
            description: 'Enter a bet (e.g. 1000, 2k, 4.5k).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
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
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'Use `/register` first.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const targetDiscordUser = interaction.options.getUser('player', true);
        const targetUser = await (0, utils_1.checkUserRegistration)(targetDiscordUser.id, interaction.guildId);
        if (!targetUser) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'Target user not registered.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (interaction.user.id === targetDiscordUser.id || targetDiscordUser.bot) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input', 'Cannot play against this user.'),
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
        const betAmount = (0, utils_1.parseReadableStringToNumber)(interaction.options.getString('bet', true));
        const readableBetAmount = (0, utils_1.formatNumberToReadableString)(betAmount);
        const realWinAmount = betAmount * (1 - configReply.casinoSettings.rps.casinoCut);
        const isBetValid = (0, utils_1.checkValidBet)(interaction, betAmount, configReply.casinoSettings.rps.maxBet, configReply.casinoSettings.rps.minBet, user.balance);
        if (!isBetValid)
            return;
        const betId = (0, utils_1.generateBetId)();
        const embed = (0, createEmbed_1.createBetEmbed)('Rock, paper, scissors!', 'Yellow', `It’s now ${targetDiscordUser}'s turn!`, betId);
        const row = new discord_js_1.ActionRowBuilder().addComponents(choices.map((c) => new discord_js_1.ButtonBuilder()
            .setCustomId(c.name)
            .setLabel(c.name)
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji(c.emoji)));
        const reply = await interaction.reply({
            content: `${targetDiscordUser}, you’ve been challenged by ${interaction.user} to a game of Rock, Paper, Scissors for **$${readableBetAmount}**!\nChoose one of the options to start the game.`,
            embeds: [embed],
            components: [row],
        });
        const targetInteraction = await reply
            .awaitMessageComponent({
            filter: (i) => i.user.id === targetDiscordUser.id,
            time: 30_000,
        })
            .catch(async () => {
            embed
                .setDescription(`Game canceled. ${targetDiscordUser} did not respond.`)
                .setColor('Red');
            await reply.edit({ content: '', embeds: [embed], components: [] });
            return null;
        });
        if (!targetInteraction)
            return;
        const targetChoice = choices.find((c) => c.name === targetInteraction.customId);
        await targetInteraction.reply({
            content: `You chose ${targetChoice.name} ${targetChoice.emoji}.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        embed.setDescription(`Now it's ${interaction.user}'s turn.`);
        await reply.edit({ content: '', embeds: [embed] });
        const initiatorInteraction = await reply
            .awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id,
            time: 30_000,
        })
            .catch(async () => {
            embed
                .setDescription(`Game canceled. ${interaction.user} did not respond.`)
                .setColor('Red');
            await reply.edit({ content: '', embeds: [embed], components: [] });
            return null;
        });
        if (!initiatorInteraction)
            return;
        const initiatorChoice = choices.find((c) => c.name === initiatorInteraction.customId);
        let winnerUser = null;
        let loserUser = null;
        let resultText = 'It’s a draw!';
        if (targetChoice.beats === initiatorChoice.name) {
            winnerUser = targetUser;
            loserUser = user;
            resultText = `${targetDiscordUser} won and took **$${(0, utils_1.formatNumberToReadableString)(realWinAmount)}** from ${interaction.user}!`;
        }
        else if (initiatorChoice.beats === targetChoice.name) {
            winnerUser = user;
            loserUser = targetUser;
            resultText = `${interaction.user} won and took **$${(0, utils_1.formatNumberToReadableString)(realWinAmount)}** from ${targetDiscordUser}!`;
        }
        if (winnerUser && loserUser) {
            await Promise.all([
                User_1.default.findOneAndUpdate({ userId: winnerUser.userId, guildId: winnerUser.guildId }, {
                    $inc: {
                        balance: realWinAmount,
                        lockedBalance: -Math.min(winnerUser.lockedBalance, betAmount),
                    },
                }),
                User_1.default.findOneAndUpdate({ userId: loserUser.userId, guildId: loserUser.guildId }, {
                    $inc: {
                        balance: -betAmount,
                        lockedBalance: -Math.min(loserUser.lockedBalance, betAmount),
                    },
                }),
                Transaction_1.default.insertMany([
                    {
                        userId: winnerUser.userId,
                        guildId: winnerUser.guildId,
                        amount: betAmount,
                        type: 'bet',
                        source: 'casino',
                        betId,
                        createdAt: new Date(),
                    },
                    {
                        userId: loserUser.userId,
                        guildId: loserUser.guildId,
                        amount: betAmount,
                        type: 'bet',
                        source: 'casino',
                        betId,
                        createdAt: new Date(),
                    },
                    {
                        userId: winnerUser.userId,
                        guildId: winnerUser.guildId,
                        amount: realWinAmount,
                        type: 'win',
                        source: 'casino',
                        betId,
                        createdAt: new Date(),
                    },
                ]),
            ]);
        }
        embed.setDescription(`${targetDiscordUser} chose ${targetChoice.name} ${targetChoice.emoji} \n${interaction.user} chose ${initiatorChoice.name} ${initiatorChoice.emoji}\n\n${resultText}`);
        await reply.edit({ content: '', embeds: [embed], components: [] });
    }
    catch (error) {
        console.error('Error running RPS command:', error);
    }
}
