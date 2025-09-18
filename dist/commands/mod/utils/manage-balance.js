"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const User_1 = require("../../../models/User");
const utils_1 = require("../../../utils/utils");
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../utils/createEmbed");
const Transaction_1 = require("../../../models/Transaction");
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
            name: 'bonus',
            description: 'Give a bonus to a user.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user you want to give a bonus to.',
                    type: discord_js_1.ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: 'amount',
                    description: 'The bonus amount to give. (You can also enter 1000, 2.5k, 2M).',
                    type: discord_js_1.ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        // {
        //   name: 'remove-bonus',
        //   description: 'Remove bonus funds from a user (admin only).',
        //   type: ApplicationCommandOptionType.Subcommand,
        //   options: [
        //     {
        //       name: 'user',
        //       description: 'The user whose bonus you want to remove.',
        //       type: ApplicationCommandOptionType.User,
        //       required: true,
        //     },
        //     {
        //       name: 'amount',
        //       description:
        //         'The amount of bonus to remove. (You can also enter 1000, 2.5k, 2M).',
        //       type: ApplicationCommandOptionType.String,
        //       required: true,
        //     },
        //   ],
        // },
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
            name: 'reset',
            description: 'Reset a user’s balance to $0 and remove all their transactions in this server.',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user whose balance and transaction history you want to reset.',
                    type: discord_js_1.ApplicationCommandOptionType.User,
                    required: true,
                },
            ],
        },
    ],
    dm_permission: false,
};
exports.options = {
    botPermissions: ['Administrator'],
    deleted: false,
};
async function run({ interaction, client }) {
    try {
        const configReply = await (0, utils_1.checkChannelConfiguration)(interaction, 'atmChannelIds', {
            notSet: 'This server has not been configured for ATM logs yet.\nSet it up using web dashboard.',
            notAllowed: `This channel is not configured for ATM logs. Try one of these channels:`,
        });
        if (!configReply)
            return;
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const hasAdmin = member?.permissions.has('Administrator');
        const managerRoleId = configReply.managerRoleId;
        const hasManager = managerRoleId && member?.roles.cache.has(managerRoleId);
        if (!hasAdmin && !hasManager) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Permission Denied', `You need to be an **Administrator** or have the ${managerRoleId ? `<@&${managerRoleId}>` : '**Manager role**'} to use this command.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const user = options.getUser('user', true);
        if (user.bot) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Invalid Input - Bot user', 'This command cannot target a bot.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const amountStr = options.getString('amount', false);
        const parsedAmount = amountStr ? (0, utils_1.parseReadableStringToNumber)(amountStr) : 0;
        const readableAmount = (0, utils_1.formatNumberToReadableString)(parsedAmount);
        const userDocument = await User_1.default.findOne({
            userId: user.id,
            guildId: interaction.guildId,
        });
        if (!userDocument) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'This user has not registered yet.\nThey should use `/register` or `/force-register`.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (subcommand === 'deposit') {
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input', 'Enter a positive number.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const updatedUser = await User_1.default.findOneAndUpdate({ userId: user.id, guildId: interaction.guildId }, { $inc: { balance: parsedAmount } }, { new: true });
            await Transaction_1.default.create({
                userId: user.id,
                guildId: interaction.guildId,
                amount: parsedAmount,
                type: 'deposit',
                source: 'command',
                handledBy: interaction.user.id,
                createdAt: new Date(),
            });
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('ATM - Admin Deposit', `You have successfully added **$${readableAmount}** to <@${user.id}>.\nTheir new balance is now: **$${(0, utils_1.formatNumberToReadableString)(updatedUser.balance)}**.`),
                ],
            });
        }
        if (subcommand === 'withdraw') {
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input', 'Enter a positive number.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const withdrawable = userDocument.balance - userDocument.lockedBalance;
            if (withdrawable < parsedAmount) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Insufficient Withdrawable Funds', `You cannot withdraw **$${readableAmount}** because **$${(0, utils_1.formatNumberToReadableString)(userDocument.lockedBalance)}** of the balance comes from bonuses.\n\nThey must wager the bonuses first.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const updatedUser = await User_1.default.findOneAndUpdate({ userId: user.id, guildId: interaction.guildId }, { $inc: { balance: -parsedAmount } }, { new: true });
            await Transaction_1.default.create({
                userId: user.id,
                guildId: interaction.guildId,
                amount: parsedAmount,
                type: 'withdraw',
                source: 'command',
                handledBy: interaction.user.id,
                createdAt: new Date(),
            });
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('ATM - Admin Withdraw', `Removed **$${readableAmount}** from <@${user.id}>.\nNew balance: **$${(0, utils_1.formatNumberToReadableString)(updatedUser.balance)}**.`),
                ],
            });
        }
        if (subcommand === 'bonus') {
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Invalid Input', 'Enter a positive number.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const updatedUser = await User_1.default.findOneAndUpdate({ userId: user.id, guildId: interaction.guildId }, { $inc: { balance: parsedAmount, lockedBalance: parsedAmount } }, { new: true });
            await Transaction_1.default.create({
                userId: user.id,
                guildId: interaction.guildId,
                amount: parsedAmount,
                type: 'bonus',
                source: 'command',
                handledBy: interaction.user.id,
                createdAt: new Date(),
            });
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('ATM - Bonus Given', `You have successfully given **$${readableAmount}** bonus to <@${user.id}>.\nTheir new balance is now: **$${(0, utils_1.formatNumberToReadableString)(updatedUser.balance)}**.`),
                ],
            });
        }
        // if (subcommand === 'remove-bonus') {
        //   if (isNaN(parsedAmount) || parsedAmount <= 0) {
        //     return interaction.reply({
        //       embeds: [
        //         createInfoEmbed('Invalid Input', 'Enter a positive number.'),
        //       ],
        //       flags: MessageFlags.Ephemeral,
        //     })
        //   }
        //   if (userDocument.lockedBalance < parsedAmount) {
        //     return interaction.reply({
        //       embeds: [
        //         createInfoEmbed(
        //           'Insufficient Bonus Funds',
        //           `User <@${user.id}> only has **$${formatNumberToReadableString(
        //             userDocument.lockedBalance
        //           )}** in bonus funds.`
        //         ),
        //       ],
        //       flags: MessageFlags.Ephemeral,
        //     })
        //   }
        //   const updatedUser = await User.findOneAndUpdate(
        //     { userId: user.id, guildId: interaction.guildId },
        //     { $inc: { balance: -parsedAmount, lockedBalance: -parsedAmount } },
        //     { new: true }
        //   )
        //   await Transaction.create({
        //     userId: user.id,
        //     guildId: interaction.guildId,
        //     amount: parsedAmount,
        //     type: 'remove-bonus',
        //     source: 'command',
        //     handledBy: interaction.user.id,
        //     createdAt: new Date(),
        //   })
        //   return interaction.reply({
        //     embeds: [
        //       createSuccessEmbed(
        //         'ATM - Bonus Removed',
        //         `Removed **$${readableAmount}** bonus from <@${
        //           user.id
        //         }>.\nNew balance: **$${formatNumberToReadableString(
        //           updatedUser!.balance
        //         )}**.`
        //       ),
        //     ],
        //   })
        // }
        if (subcommand === 'reset') {
            await User_1.default.findOneAndUpdate({ userId: user.id, guildId: interaction.guildId }, { $set: { balance: 0, lockedBalance: 0 } });
            await Transaction_1.default.deleteMany({
                userId: user.id,
                guildId: interaction.guildId,
            });
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('ATM - Admin Reset', `Reset balance and cleared transactions of <@${user.id}>.`),
                ],
            });
        }
        if (subcommand === 'check') {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createSuccessEmbed)('ATM - Admin Check', `Balance of <@${user.id}>: **$${(0, utils_1.formatNumberToReadableString)(userDocument.balance)}**\nBonus (locked) balance: **$${(0, utils_1.formatNumberToReadableString)(userDocument.lockedBalance)}**`),
                ],
            });
        }
    }
    catch (error) {
        console.error('Error running /manage-balance:', error);
    }
}
