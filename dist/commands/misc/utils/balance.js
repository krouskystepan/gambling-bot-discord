import { MessageFlags } from 'discord.js';
import { handleUnexpectedInteractionError } from '@/errors';
import { checkUserRegistration } from '@/services';
import { formatNumberToReadableString } from '@/utils/common/utils';
import { createSuccessEmbed } from '@/utils/discord/createEmbed';
export const data = {
    name: 'balance',
    description: 'Check your current balance (only you can see this).',
    dm_permission: false
};
export const options = {
    deleted: false
};
export async function run({ interaction }) {
    try {
        const user = await checkUserRegistration({ interaction });
        if (!user)
            return;
        return interaction.reply({
            embeds: [
                createSuccessEmbed('ATM - Balance', `Your balance is **$${formatNumberToReadableString(user.balance)}** ($${user.balance}).`)
            ],
            flags: MessageFlags.Ephemeral
        });
    }
    catch (error) {
        await handleUnexpectedInteractionError(interaction, error);
    }
}
