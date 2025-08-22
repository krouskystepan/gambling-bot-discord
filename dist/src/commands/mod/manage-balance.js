"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const User_1 = require("../../models/User");
const utils_1 = require("../../utils/utils");
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../utils/createEmbed");
exports.data = {
    name: 'manage-balance',
    description: 'Manage user balances.',
    options: [
        {
            name: 'deposit',
            description: 'Add money to a user.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user to whom you want to add money.',
                    type: discord_js_1.ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: 'amount',
                    description: 'The amount you want to add. (You can also enter 1000, 2.5k, 2M).',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            name: 'withdraw',
            description: 'Remove money from a user.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user from whom you want to remove money.',
                    type: discord_js_1.ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: 'amount',
                    description: 'The amount you want to remove. (You can also enter 5k, 2.5k, 2M).',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            name: 'check',
            description: 'Check a user’s balance.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user whose balance you want to check.',
                    type: discord_js_1.ApplicationCommandOptionType.User,
                    required: true,
                },
            ],
        },
        {
            name: 'list',
            description: 'Check the balance of all users.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
        },
        {
            name: 'reset',
            description: 'Reset a user’s balance.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user whose balance you want to reset.',
                    type: discord_js_1.ApplicationCommandOptionType.User,
                    required: true,
                },
            ],
        },
    ],
    contexts: [0],
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false,
};
async function run({ interaction, client }) {
    try {
        const configReply = await (0, utils_1.checkChannelConfiguration)(interaction, 'adminChannelIds', {
            notSet: 'This server has not been configured for betting commands yet. Set it up using `/setup-manage`.',
            notAllowed: `This channel is not configured for betting commands. Try one of these channels:`,
        });
        if (configReply)
            return;
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        if (subcommand === 'deposit') {
            const user = interaction.options.getUser('user', true);
            if (user.bot) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Bot user', 'You cannot deposit money to a bot.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const amount = interaction.options.getString('amount', true);
            const parsedAmount = (0, utils_1.parseReadableStringToNumber)(amount);
            if (isNaN(parsedAmount)) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Not a number', 'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (parsedAmount <= 0) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Non-positive number', 'The number you provided must be greater than 0.\nPlease enter a positive value.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const userDocument = await User_1.default.findOne({
                userId: user.id,
                guildId: interaction.guildId,
            });
            if (!userDocument) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'This user has not registered yet.\nThey should use `/register` or you can force register them with `/force-register`.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            userDocument.balance += parsedAmount;
            await userDocument.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('ATM - Admin Deposit', `You have successfully added **$${amount}** to <@${user.id}>.\nTheir new balance is now: **$${(0, utils_1.formatNumberToReadableString)(userDocument.balance)}**.`),
                ],
            });
        }
        if (subcommand === 'withdraw') {
            const user = interaction.options.getUser('user', true);
            if (user.bot) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Bot user', 'You cannot withdraw money from a bot.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const amount = interaction.options.getString('amount', true);
            const parsedAmount = (0, utils_1.parseReadableStringToNumber)(amount);
            if (isNaN(parsedAmount)) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Not a number', 'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (parsedAmount <= 0) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Non-positive number', 'The number you provided must be greater than 0.\nPlease enter a positive value.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const userDocument = await User_1.default.findOne({
                userId: user.id,
                guildId: interaction.guildId,
            });
            if (!userDocument) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'This user has not registered yet.\nThey should use `/register` or you can force register them with `/force-register`.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            if (userDocument.balance < parsedAmount) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Insufficient Funds', `User <@${userDocument.id}> does not have enough balance.\nCurrent balance: $${(0, utils_1.formatNumberToReadableString)(userDocument.balance)}.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            userDocument.balance -= parsedAmount;
            await userDocument.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('ATM - Admin Withdraw', `You have successfully removed **$${amount}** from <@${user.id}>.\nTheir new balance is now: **$${(0, utils_1.formatNumberToReadableString)(userDocument.balance)}**.`),
                ],
            });
        }
        if (subcommand === 'reset') {
            const user = interaction.options.getUser('user', true);
            if (user.bot) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Bot user', 'You cannot reset the balance of a bot.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const userDocument = await User_1.default.findOne({
                userId: user.id,
                guildId: interaction.guildId,
            });
            if (!userDocument) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'This user has not registered yet.\nThey should use `/register` or you can force register them with `/force-register`.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            userDocument.balance = 0;
            await userDocument.save();
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('ATM - Admin Reset', `You have successfully reset the balance of <@${user.id}>.\nTheir new balance is now: **$${(0, utils_1.formatNumberToReadableString)(userDocument.balance)}**.`),
                ],
            });
        }
        if (subcommand === 'check') {
            const user = interaction.options.getUser('user', true);
            if (user.bot) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input - Bot user', 'You cannot check the balance of a bot.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const userDocument = await User_1.default.findOne({
                userId: user.id,
                guildId: interaction.guildId,
            });
            if (!userDocument) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'This user has not registered yet.\nThey should use `/register` or you can force register them with `/force-register`.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('ATM - Admin Check', `The balance of <@${user.id}> is **$${(0, utils_1.formatNumberToReadableString)(userDocument.balance)}**.`),
                ],
            });
        }
        if (subcommand === 'list') {
            const users = await User_1.default.find({ guildId: interaction.guildId });
            if (!users.length) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('No users found', 'No users have registered yet.'),
                    ],
                });
            }
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('ATM - User Balances', users
                        .sort((a, b) => b.balance - a.balance)
                        .map((user) => `<@${user.userId}>: **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**.`)
                        .join('\n')),
                ],
            });
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
