"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const utils_1 = require("../../../utils/utils");
const discord_js_1 = require("discord.js");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const createEmbed_1 = require("../../../utils/createEmbed");
const User_1 = require("../../../models/User");
exports.data = {
    name: 'withdraw',
    description: 'Withdraw money from your account.',
    options: [
        {
            name: 'amount',
            description: 'The amount you want to withdraw (e.g., 1000, 2k, 10.5k).',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'account',
            description: 'The account you want to send the money to.',
            type: discord_js_1.ApplicationCommandOptionType.String,
            required: true,
        },
    ],
    dm_permission: false,
};
exports.options = {
    deleted: false,
};
async function run({ interaction, client }) {
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
        const guildConfiguration = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfiguration?.atmChannelIds.logs) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Logs Not Set Up', 'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (!guildConfiguration?.atmChannelIds.actions) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Actions Not Configured', 'This ATM command has not been set up yet.\nPlease contact an administrator to complete the setup.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (guildConfiguration?.atmChannelIds.actions !== interaction.channelId) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Incorrect Channel', `This command can only be used in <#${guildConfiguration.atmChannelIds.actions}>.\nPlease use the correct channel to proceed.`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const account = interaction.options.getString('account', true);
        const amount = interaction.options.getString('amount', true);
        const parsedAmount = (0, utils_1.parseReadableStringToNumber)(amount);
        const readableAmount = (0, utils_1.formatNumberToReadableString)(parsedAmount);
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
        const updatedUser = await User_1.default.findOneAndUpdate({
            userId: interaction.user.id,
            guildId: interaction.guildId,
            balance: { $gte: parsedAmount },
            $expr: {
                $gte: [{ $subtract: ['$balance', '$lockedBalance'] }, parsedAmount],
            },
        }, {
            $inc: { balance: -parsedAmount },
        }, { new: true });
        if (!updatedUser) {
            if (user.balance < parsedAmount) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Insufficient Funds', `You don't have enough funds to withdraw **$${readableAmount}**.\nYour current balance is **$${(0, utils_1.formatNumberToReadableString)(user.balance)}**.`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            const withdrawable = user.balance - user.lockedBalance;
            if (withdrawable < parsedAmount && withdrawable >= 0) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Insufficient Withdrawable Funds', `You requested **$${readableAmount}**, but you can only withdraw up to **$${(0, utils_1.formatNumberToReadableString)(withdrawable)}**.\n` +
                            (withdrawable < user.balance
                                ? `**$${(0, utils_1.formatNumberToReadableString)(user.balance - withdrawable)}** of your balance is locked (e.g., bonuses).\n\nYou need to wager those bonuses before you can withdraw them.`
                                : `\n\nYou need to wager any bonuses before you can withdraw them.`)),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
        }
        const logChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.logs);
        const member = interaction.member;
        const displayName = member?.displayName ||
            interaction.user.globalName ||
            interaction.user.username;
        const managerRole = guildConfiguration.managerRoleId;
        const logMessage = await logChannel.send({
            content: managerRole ? `<@&${managerRole}>` : '',
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setTitle(`ATM - Withdrawal by ${displayName} (${interaction.user.username})`)
                    .setColor('Red')
                    .setDescription(`<@${interaction.user.id}> wants to withdraw **$${readableAmount}** into account **${account}**.`),
            ],
            components: [],
        });
        const approveButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`atm-withdraw.approve._.${interaction.user.id}-${logMessage.id}.${parsedAmount}`)
            .setLabel('Approve')
            .setStyle(discord_js_1.ButtonStyle.Success);
        const rejectButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`atm-withdraw.reject._.${interaction.user.id}-${logMessage.id}.${parsedAmount}`)
            .setLabel('Reject')
            .setStyle(discord_js_1.ButtonStyle.Danger);
        const row = new discord_js_1.ActionRowBuilder().addComponents(approveButton, rejectButton);
        await logMessage.edit({ components: [row] });
        return interaction.reply({
            embeds: [
                (0, createEmbed_1.createSuccessEmbed)('ATM - Withdraw', `You have requested to withdraw **$${readableAmount}**.\nPlease wait for the transaction to be processed.`),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
