import { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { handleUnexpectedInteractionError } from '@/errors';
import { checkAtmChannels, checkUserRegistration, withdrawBalance } from '@/services';
import { formatNumberToReadableString, parseReadableStringToNumber } from '@/utils/common/utils';
import { createInfoEmbed, createSuccessEmbed } from '@/utils/discord/createEmbed';
export const data = {
    name: 'withdraw',
    description: 'Withdraw money from your account.',
    options: [
        {
            name: 'amount',
            description: 'The amount you want to withdraw (e.g., 1000, 2k, 10.5k).',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'account',
            description: 'The account you want to send the money to.',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],
    dm_permission: false
};
export const options = {
    deleted: false
};
export async function run({ interaction, client }) {
    try {
        const user = await checkUserRegistration({ interaction });
        if (!user)
            return;
        const guildConfiguration = await checkAtmChannels(interaction);
        if (!guildConfiguration)
            return;
        const account = interaction.options.getString('account', true);
        const amount = interaction.options.getString('amount', true);
        const parsedAmount = parseReadableStringToNumber(amount);
        const readableAmount = formatNumberToReadableString(parsedAmount);
        if (isNaN(parsedAmount)) {
            return interaction.reply({
                embeds: [
                    createInfoEmbed('Invalid Input - Not a number', 'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        if (parsedAmount <= 0) {
            return interaction.reply({
                embeds: [
                    createInfoEmbed('Invalid Input - Non-positive number', 'The number you provided must be greater than 0.\nPlease enter a positive value.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        const result = await withdrawBalance({
            userId: interaction.user.id,
            guildId: interaction.guildId,
            amount: parsedAmount
        });
        if (!result.ok) {
            if (result.reason === 'INSUFFICIENT_BALANCE') {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Insufficient Funds', `You don't have enough funds to withdraw **$${readableAmount}**.\nYour current balance is **$${formatNumberToReadableString(result.balance)}**.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            if (result.reason === 'INSUFFICIENT_WITHDRAWABLE') {
                return interaction.reply({
                    embeds: [
                        createInfoEmbed('Insufficient Withdrawable Funds', `You requested **$${readableAmount}**, but you can only withdraw up to **$${formatNumberToReadableString(result.withdrawable)}**.\n` +
                            (result.locked > 0
                                ? `**$${formatNumberToReadableString(result.locked)}** of your balance is locked (e.g., bonuses).\n\nYou need to wager those bonuses before you can withdraw them.`
                                : ''))
                    ],
                    flags: MessageFlags.Ephemeral
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
                new EmbedBuilder()
                    .setTitle(`ATM - Withdrawal by ${displayName} (${interaction.user.username})`)
                    .setColor('Red')
                    .setDescription(`<@${interaction.user.id}> wants to withdraw **$${readableAmount}** into account **${account}**.`)
            ],
            components: []
        });
        const approveButton = new ButtonBuilder()
            .setCustomId(`atm-withdraw.approve._.${interaction.user.id}-${logMessage.id}.${parsedAmount}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success);
        const rejectButton = new ButtonBuilder()
            .setCustomId(`atm-withdraw.reject._.${interaction.user.id}-${logMessage.id}.${parsedAmount}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(approveButton, rejectButton);
        await logMessage.edit({ components: [row] });
        return interaction.reply({
            embeds: [
                createSuccessEmbed('ATM - Withdraw', `You have requested to withdraw **$${readableAmount}**.\nPlease wait for the transaction to be processed.`)
            ],
            flags: MessageFlags.Ephemeral
        });
    }
    catch (error) {
        await handleUnexpectedInteractionError(interaction, error);
    }
}
