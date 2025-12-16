import { EmbedBuilder, MessageFlags } from 'discord.js';
import { getGuildConfigByGuildId, getUser, resetUserBalance, updateUserBalance } from '@/services';
import { formatNumberToReadableString } from '@/utils/common/utils';
import { createErrorEmbed } from '@/utils/discord/createEmbed';
//! DB TRANSACTIONS
//! Rare condition - no .save()
export default async (interaction, client) => {
    if (!interaction.isButton() || !interaction.customId)
        return;
    try {
        const [type, amount] = interaction.customId.split('.');
        if (type !== 'give-money' && type !== 'reset-money')
            return;
        const guildConfiguration = await getGuildConfigByGuildId({
            guildId: interaction.guildId
        });
        if (!guildConfiguration?.atmChannelIds.logs) {
            return interaction.reply({
                embeds: [
                    createErrorEmbed('Error - Not Configured', 'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        const user = await getUser({
            guildId: interaction.guildId,
            userId: interaction.user.id
        });
        if (!user) {
            return interaction.reply({
                embeds: [
                    createErrorEmbed('Error - Not registered', 'You are not registered yet.\nUse the `/register` command to register.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        if (type === 'give-money') {
            if (!amount)
                return;
            const parsedAmount = parseInt(amount);
            updateUserBalance({
                userId: interaction.user.id,
                guildId: interaction.guildId,
                amount: parsedAmount
            });
            const logChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.logs);
            logChannel
                .send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('ATM - Money Generator')
                        .setDescription(`<@${interaction.user.id}> has added **$${formatNumberToReadableString(parsedAmount)}** to their account.`)
                        .setColor('DarkGreen')
                ]
            })
                .catch(console.error);
            const embed = new EmbedBuilder()
                .setTitle('ATM - Money Generator')
                .setDescription(`Server has added **$${formatNumberToReadableString(parsedAmount)}** to your account.\nYour new balance is **$${formatNumberToReadableString(user.balance)}**.`)
                .setColor('DarkGreen');
            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        }
        if (type === 'reset-money') {
            resetUserBalance({
                userId: interaction.user.id,
                guildId: interaction.guildId
            });
            const logChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.logs);
            logChannel
                .send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('ATM - Money Reset')
                        .setDescription(`<@${interaction.user.id}> has reset their account balance.`)
                        .setColor('DarkRed')
                ]
            })
                .catch(console.error);
            const embed = new EmbedBuilder()
                .setTitle('ATM - Money Reset')
                .setDescription(`Server has reset your account balance.\nYour new balance is **$${formatNumberToReadableString(user.balance)}**.`)
                .setColor('DarkRed');
            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        }
    }
    catch (error) {
        console.error('Error in handleGiveMoney.ts', error);
    }
};
