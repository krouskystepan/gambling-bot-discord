import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { checkAtmChannels, checkTargetUserRegistration, createTransaction, deleteAllTransactionsByUserId, resetUserBalance, updateUserBalance } from '@/services';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '@/utils/createEmbed';
import { formatNumberToReadableString, parseReadableStringToNumber } from '@/utils/utils';
export const data = {
    name: 'manage-balance',
    description: 'Manage user balances.',
    options: [
        {
            name: 'deposit',
            description: 'Add money to a user.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user to whom you want to add money.',
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: 'amount',
                    description: 'The amount you want to add. (You can also enter 1000, 2.5k, 2M).',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        },
        {
            name: 'withdraw',
            description: 'Remove money from a user.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user from whom you want to remove money.',
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: 'amount',
                    description: 'The amount you want to remove. (You can also enter 5k, 2.5k, 2M).',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        },
        {
            name: 'bonus',
            description: 'Give a bonus to a user.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user you want to give a bonus to.',
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: 'amount',
                    description: 'The bonus amount to give. (You can also enter 1000, 2.5k, 2M).',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
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
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user whose balance you want to check.',
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: 'reset',
            description: 'Reset a user’s balance to $0 and remove all their transactions in this server.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: 'The user whose balance and transaction history you want to reset.',
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        }
    ],
    dm_permission: false
};
export const options = {
    botPermissions: ['Administrator'],
    deleted: false
};
export async function run({ interaction }) {
    try {
        const configReply = await checkAtmChannels(interaction);
        if (!configReply)
            return;
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const hasAdmin = member?.permissions.has('Administrator');
        const managerRoleId = configReply.managerRoleId;
        const hasManager = managerRoleId && member?.roles.cache.has(managerRoleId);
        if (!hasAdmin && !hasManager) {
            return interaction.reply({
                embeds: [
                    createErrorEmbed('Permission Denied', `You need to be an **Administrator** or have the ${managerRoleId ? `<@&${managerRoleId}>` : '**Manager role**'} to use this command.`)
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        const user = options.getUser('user', true);
        if (user.bot) {
            return interaction.reply({
                embeds: [
                    createInfoEmbed('Invalid Input - Bot user', 'This command cannot target a bot.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        const amountStr = options.getString('amount', false);
        const parsedAmount = amountStr ? parseReadableStringToNumber(amountStr) : 0;
        const readableAmount = formatNumberToReadableString(parsedAmount);
        const targetUser = await checkTargetUserRegistration({
            interaction,
            targetUserId: user.id
        });
        if (!targetUser)
            return;
        if (subcommand === 'deposit') {
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Invalid Input', 'Enter a positive number.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const updatedUser = await updateUserBalance({
                userId: user.id,
                guildId: interaction.guildId,
                amount: parsedAmount
            });
            await createTransaction({
                userId: user.id,
                guildId: interaction.guildId,
                amount: parsedAmount,
                type: 'deposit',
                source: 'command',
                handledBy: interaction.user.id
            });
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('ATM - Admin Deposit', `You have successfully added **$${readableAmount}** to <@${user.id}>.\nTheir new balance is now: **$${formatNumberToReadableString(updatedUser.balance)}**.`)
                ]
            });
        }
        if (subcommand === 'withdraw') {
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Invalid Input', 'Enter a positive number.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const withdrawable = targetUser.balance - targetUser.lockedBalance;
            if (withdrawable < parsedAmount) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Insufficient Withdrawable Funds', `You cannot withdraw **$${readableAmount}** because **$${formatNumberToReadableString(targetUser.lockedBalance)}** of the balance comes from bonuses.\n\nThey must wager the bonuses first.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const updatedUser = await updateUserBalance({
                userId: user.id,
                guildId: interaction.guildId,
                amount: -parsedAmount
            });
            await createTransaction({
                userId: user.id,
                guildId: interaction.guildId,
                amount: parsedAmount,
                type: 'withdraw',
                source: 'command',
                handledBy: interaction.user.id
            });
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('ATM - Admin Withdraw', `Removed **$${readableAmount}** from <@${user.id}>.\nNew balance: **$${formatNumberToReadableString(updatedUser.balance)}**.`)
                ]
            });
        }
        if (subcommand === 'bonus') {
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Invalid Input', 'Enter a positive number.')
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            await updateUserBalance({
                userId: user.id,
                guildId: interaction.guildId,
                amount: parsedAmount,
                lockedAmount: parsedAmount
            });
            await createTransaction({
                userId: user.id,
                guildId: interaction.guildId,
                amount: parsedAmount,
                type: 'bonus',
                source: 'command',
                handledBy: interaction.user.id
            });
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('ATM - Bonus Given', `You have successfully given **$${readableAmount}** bonus to <@${user.id}>.\nTheir new balance is now: **$${formatNumberToReadableString(targetUser.balance)}**.`)
                ]
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
            await resetUserBalance({
                userId: user.id,
                guildId: interaction.guildId
            });
            await deleteAllTransactionsByUserId({
                userId: user.id,
                guildId: interaction.guildId
            });
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('ATM - Admin Reset', `Reset balance and cleared transactions of <@${user.id}>.`)
                ]
            });
        }
        if (subcommand === 'check') {
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('ATM - Admin Check', `Balance of <@${user.id}>: **$${formatNumberToReadableString(targetUser.balance)}**\nBonus (locked) balance: **$${formatNumberToReadableString(targetUser.lockedBalance)}**`)
                ]
            });
        }
    }
    catch (error) {
        console.error('Error running /manage-balance:', error);
    }
}
