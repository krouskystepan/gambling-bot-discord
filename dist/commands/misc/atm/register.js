import { EmbedBuilder, MessageFlags } from 'discord.js';
import { handleUnexpectedInteractionError } from '@/errors';
import { checkAtmChannels, createUser, getUser } from '@/services';
import { createErrorEmbed, createSuccessEmbed } from '@/utils/discord/createEmbed';
export const data = {
    name: 'register',
    description: 'Register yourself in the system.',
    dm_permission: false
};
export const options = {
    deleted: false
};
export async function run({ interaction, client }) {
    try {
        const guildConfiguration = await checkAtmChannels(interaction);
        if (!guildConfiguration)
            return;
        const user = await getUser({
            userId: interaction.user.id,
            guildId: interaction.guildId
        });
        if (user) {
            return interaction.reply({
                embeds: [
                    createErrorEmbed('ATM Error - Registered', 'You are already registered in the system.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        await createUser({
            userId: interaction.user.id,
            guildId: interaction.guildId
        });
        const logChannel = client.channels.cache.get(guildConfiguration.atmChannelIds.logs);
        logChannel
            .send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('ATM - User Registration')
                    .setDescription(`User <@${interaction.user.id}> has successfully registered in the system.`)
                    .setColor('White')
            ]
        })
            .catch(console.error);
        return interaction.reply({
            embeds: [
                createSuccessEmbed('ATM Success - Registered', 'You have been successfully registered in the system.')
            ],
            flags: MessageFlags.Ephemeral
        });
    }
    catch (error) {
        await handleUnexpectedInteractionError(interaction, error);
    }
}
