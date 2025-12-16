import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } from 'discord.js';
import { forceDeleteUser, getGuildConfigByGuildId } from '@/services';
import { createErrorEmbed, createSuccessEmbed } from '@/utils/discord/createEmbed';
export const data = {
    name: 'force-unregister',
    description: 'Unregister a user (delete from DB).',
    options: [
        {
            name: 'user-id',
            description: 'The ID of the user you want to unregister.',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],
    dm_permission: false
};
export const options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false
};
export async function run({ interaction, client }) {
    try {
        const guildConfig = await getGuildConfigByGuildId({
            guildId: interaction.guildId
        });
        if (!guildConfig?.atmChannelIds?.logs) {
            return interaction.reply({
                embeds: [
                    createErrorEmbed('Error - Logs Not Set Up', 'ATM logs are not configured yet.\nPlease contact an administrator.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        const userId = interaction.options.getString('user-id', true);
        const deletedUser = await forceDeleteUser({
            userId,
            guildId: interaction.guildId
        });
        if (!deletedUser) {
            return interaction.reply({
                embeds: [
                    createErrorEmbed('ATM Error - Not Registered', 'User is not registered in the system.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        const logChannel = client.channels.cache.get(guildConfig.atmChannelIds.logs);
        await logChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('ATM - User Unregistered')
                    .setDescription(`Manager <@${interaction.user.id}> has unregistered <@${userId}>.`)
                    .setColor('NotQuiteBlack')
            ]
        });
        return interaction.reply({
            embeds: [
                createSuccessEmbed('ATM Success - Unregistered', `The user <@${userId}> has been successfully unregistered.`)
            ],
            flags: MessageFlags.Ephemeral
        });
    }
    catch (error) {
        console.error('Error running /force-unregister:', error);
    }
}
