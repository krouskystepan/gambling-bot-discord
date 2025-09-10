"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../../utils/createEmbed");
const utils_1 = require("../../../../utils/utils");
const choices = [
    {
        name: 'rock',
        emoji: '🪨',
        beats: 'scissors',
    },
    {
        name: 'scissors',
        emoji: '✂️',
        beats: 'paper',
    },
    {
        name: 'paper',
        emoji: '📄',
        beats: 'rock',
    },
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
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'You are not registered yet.\nUse the `/register` command to register.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const targetDiscordUser = interaction.options.getUser('player', true);
        const targetUser = await (0, utils_1.checkUserRegistration)(targetDiscordUser.id, interaction.guildId);
        if (!targetUser) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'The user you want to play against is not registered yet.'),
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
        if (interaction.user.id === targetDiscordUser.id) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Same user', 'You cannot play against yourself.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (targetDiscordUser.bot) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Bot user', 'You cannot play against a bot.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const betAmount = interaction.options.getString('bet', true);
        const parsedBetAmount = (0, utils_1.parseReadableStringToNumber)(betAmount);
        const readableBetAmount = (0, utils_1.formatNumberToReadableString)(parsedBetAmount);
        const realWinAmount = parsedBetAmount * (1 - configReply.casinoSettings.rps.casinoCut);
        const isBetValid = (0, utils_1.checkValidBet)(interaction, parsedBetAmount, configReply.casinoSettings.rps.maxBet, configReply.casinoSettings.rps.minBet, user.balance);
        if (!isBetValid)
            return;
        const embed = (0, createEmbed_1.createBetEmbed)('Rock, paper, scissors!', 'Yellow', `It’s now ${targetDiscordUser}'s turn!`);
        const buttons = choices.map((choice) => {
            return new discord_js_1.ButtonBuilder()
                .setCustomId(choice.name)
                .setLabel(choice.name)
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setEmoji(choice.emoji);
        });
        const row = new discord_js_1.ActionRowBuilder().addComponents(buttons);
        const reply = await interaction.reply({
            content: `${targetDiscordUser}, you’ve been challenged by ${interaction.user} to a game of Rock, Paper, Scissors for **$${readableBetAmount}**!\nChoose one of the options to start the game.`,
            embeds: [embed],
            components: [row],
        });
        const targetUserInteraction = await reply
            .awaitMessageComponent({
            filter: (i) => {
                if (i.user.id !== targetDiscordUser.id) {
                    i.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Wrong user', 'Only the mentioned user can interact with this message.'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    return false;
                }
                return true;
            },
            time: 30_000,
        })
            .catch(async (error) => {
            embed
                .setDescription(`The game has been canceled because ${targetDiscordUser} did not respond in time.`)
                .setColor('Red');
            await reply.edit({
                content: '',
                embeds: [embed],
                components: [],
            });
        });
        if (!targetUserInteraction)
            return;
        if (targetUser.balance < parsedBetAmount) {
            embed
                .setDescription(`The game has been canceled because ${targetDiscordUser} does not have enough money to place the bet.`)
                .setColor('Red');
            reply.edit({
                content: '',
                embeds: [embed],
                components: [],
            });
            return targetUserInteraction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Insufficient balance', `You don't have enough money to place this bet.\nYour current balance is **$${(0, utils_1.formatNumberToReadableString)(targetUser.balance)}**.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const targetUserChoice = choices.find((choice) => choice.name === targetUserInteraction.customId);
        await targetUserInteraction.reply({
            content: `You chose ${targetUserChoice?.name} ${targetUserChoice?.emoji}.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        embed.setDescription(`It’s now ${interaction.user}'s turn! Choose one of the options.`);
        await reply.edit({
            content: `Now it's your turn, ${interaction.user}!`,
            embeds: [embed],
        });
        const initialUserInteraction = await reply
            .awaitMessageComponent({
            filter: (i) => {
                if (i.user.id !== interaction.user.id) {
                    i.reply({
                        embeds: [
                            (0, createEmbed_1.createInfoEmbed)('Invalid Input - Wrong user', 'Only the mentioned user can interact with this message.'),
                        ],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    return false;
                }
                return true;
            },
            time: 30_000,
        })
            .catch(async (error) => {
            embed
                .setDescription(`The game has been canceled because ${interaction.user} did not respond in time.`)
                .setColor('Red');
            await reply.edit({
                content: '',
                embeds: [embed],
                components: [],
            });
        });
        if (!initialUserInteraction)
            return;
        const initialUserChoice = choices.find((choice) => choice.name === initialUserInteraction.customId);
        let result = '';
        // user.milestoneProgress += parsedBetAmount
        // targetUser.milestoneProgress += parsedBetAmount
        if (targetUserChoice?.beats === initialUserChoice?.name) {
            result = `${targetDiscordUser} won and took **$${(0, utils_1.formatNumberToReadableString)(realWinAmount)}** from ${interaction.user}!`;
            user.balance -= parsedBetAmount;
            user.netProfit -= parsedBetAmount;
            targetUser.balance += realWinAmount;
            targetUser.netProfit += realWinAmount;
            await user.save();
            await targetUser.save();
        }
        if (initialUserChoice?.beats === targetUserChoice?.name) {
            result = `${interaction.user} won and took **$${(0, utils_1.formatNumberToReadableString)(realWinAmount)}** from ${targetDiscordUser}!`;
            user.balance += realWinAmount;
            user.netProfit += realWinAmount;
            targetUser.balance -= parsedBetAmount;
            targetUser.netProfit -= parsedBetAmount;
            await user.save();
            await targetUser.save();
        }
        if (targetUserChoice?.name === initialUserChoice?.name) {
            result = 'It’s a draw!';
        }
        embed.setDescription(`${targetDiscordUser} chose ${targetUserChoice?.name} ${targetUserChoice?.emoji} \n${interaction.user} chose ${initialUserChoice?.name} ${initialUserChoice?.emoji}. \n\n${result}`);
        reply.edit({
            content: '',
            embeds: [embed],
            components: [],
        });
        // await checkMilestones(interaction, user, interaction.guildId!)
        // await checkMilestones(
        // targetUserInteraction,
        // targetUser,
        // interaction.guildId!
        // )
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
