import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ApplicationCommandOptionType,
  ChannelType,
  CommandInteractionOptionResolver,
  MessageFlags,
} from 'discord.js'
import GuildConfiguration from '../../../models/GuildConfiguration'
import {
  createErrorEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'

export const data: CommandData = {
  name: 'setup-admin',
  description: 'Manage the admin channel.',
  options: [
    {
      name: 'add',
      description: 'Set a channel for using admin commands.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The channel you want to set for admin commands.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true,
        },
      ],
    },
    {
      name: 'remove',
      description: 'Remove a channel from admin commands using its ID.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description:
            'The ID of the channel you want to remove from admin commands.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
  ],
  contexts: [0],
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    let guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (!guildConfiguration) {
      guildConfiguration = new GuildConfiguration({
        guildId: interaction.guildId,
      })
    }

    const options = interaction.options as CommandInteractionOptionResolver

    const subcommand = options.getSubcommand()

    if (subcommand === 'add') {
      const channel = interaction.options.getChannel('channel', true)

      guildConfiguration.adminChannelIds.push(channel.id)

      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Admin Channel Setup - Add',
            `Channel ${channel} has been successfully added for admin commands.`
          ),
        ],
      })
    }

    if (subcommand === 'remove') {
      const channelId = options.getString('channel-id', true)

      if (!guildConfiguration.adminChannelIds.includes(channelId)) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Admin Channel Setup - Remove',
              `Channel with ID ${channelId} is not set for admin commands.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.adminChannelIds =
        guildConfiguration.adminChannelIds.filter((id) => id !== channelId)

      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Admin Channel Setup - Remove',
            `Channel with ID ${channelId} has been successfully removed from admin commands.`
          ),
        ],
      })
    }
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
