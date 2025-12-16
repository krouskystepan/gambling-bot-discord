import { MessageFlags } from 'discord.js';
import { createErrorEmbed } from '@/utils/createEmbed';
import { getUser } from '../db/user.db';
export const checkUserRegistration = async ({ interaction }) => {
    const user = await getUser({
        userId: interaction.user.id,
        guildId: interaction.guildId
    });
    if (!user) {
        interaction.reply({
            embeds: [
                createErrorEmbed('Error - Not registered', 'You are not registered yet.\nUse the `/register` command to register.')
            ],
            flags: MessageFlags.Ephemeral
        });
        return false;
    }
    return user;
};
export const checkTargetUserRegistration = async ({ interaction, targetUserId }) => {
    const targetUser = await getUser({
        userId: targetUserId,
        guildId: interaction.guildId
    });
    if (!targetUser) {
        interaction.reply({
            embeds: [
                createErrorEmbed('Error - Not registered', 'The target user is not registered yet.\nAsk them to use the `/register` command.')
            ],
            flags: MessageFlags.Ephemeral
        });
        return false;
    }
    return targetUser;
};
