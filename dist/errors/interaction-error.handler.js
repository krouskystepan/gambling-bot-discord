import { MessageFlags } from 'discord.js';
import { createErrorEmbed } from '@/utils/createEmbed';
export const handleUnexpectedInteractionError = async (interaction, error) => {
    console.error('Unexpected interaction error', {
        command: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        error
    });
    if (interaction.replied || interaction.deferred)
        return;
    await interaction.reply({
        embeds: [
            createErrorEmbed('Unexpected error', 'Something went wrong. Please try again later.')
        ],
        flags: MessageFlags.Ephemeral
    });
};
