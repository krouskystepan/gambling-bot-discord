import { ApplicationCommandOptionType, ChannelType, MessageFlags } from 'discord.js';
import { handleUnexpectedInteractionError } from '@/errors';
import { createGuildConfiguration, getGuildConfigByGuildId } from '@/services';
import { createErrorEmbed, createSuccessEmbed } from '@/utils/discord/createEmbed';
export const data = {
    name: 'setup-casino',
    description: 'Manage the casino channels.',
    options: [
        {
            name: 'add',
            description: 'Set a channel for using casino bets.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel you want to set for casino bets.',
                    type: ApplicationCommandOptionType.Channel,
                    channel_types: [ChannelType.GuildText],
                    required: true
                }
            ]
        },
        {
            name: 'remove',
            description: 'Remove a channel for using casino bets by ID.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel-id',
                    description: 'The ID of the channel you want to remove from casino bets.',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        }
    ],
    dm_permission: false
};
export const options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: true,
    devOnly: true
};
export async function run({ interaction }) {
    try {
        let guildConfiguration = await getGuildConfigByGuildId({
            guildId: interaction.guildId
        });
        if (!guildConfiguration) {
            guildConfiguration = await createGuildConfiguration({
                guildId: interaction.guildId
            });
        }
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        if (subcommand === 'add') {
            const channel = interaction.options.getChannel('channel', true);
            if (guildConfiguration.casinoChannelIds.includes(channel.id)) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('Casino Channel Setup - Add', `The channel ${channel} is already configured for casino betting commands.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            guildConfiguration.casinoChannelIds.push(channel.id);
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('Casino Channel Setup - Add', `The channel ${channel} has been successfully set up for casino betting commands.`)
                ]
            });
        }
        if (subcommand === 'remove') {
            const channelId = options.getString('channel-id', true);
            if (!guildConfiguration.casinoChannelIds.includes(channelId)) {
                return interaction.reply({
                    embeds: [
                        createErrorEmbed('Casino Channel Setup - Remove', `The channel with ID ${channelId} is not set up for casino betting commands.`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            guildConfiguration.casinoChannelIds =
                guildConfiguration.casinoChannelIds.filter((id) => id !== channelId);
            await guildConfiguration.save();
            return interaction.reply({
                embeds: [
                    createSuccessEmbed('Casino Channel Setup - Remove', `The channel with ID ${channelId} has been successfully removed from casino betting commands.`)
                ]
            });
        }
    }
    catch (error) {
        await handleUnexpectedInteractionError(interaction, error);
    }
}
