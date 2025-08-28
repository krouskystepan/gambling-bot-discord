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
  name: 'setup-prediction',
  description: 'Manage channels for predictions.',
  options: [
    {
      name: 'add',
      description: 'Set a channel for using predictions.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The channel you want to set up for using predictions.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true,
        },
      ],
    },
    {
      name: 'remove',
      description: 'Remove a channel for using predictions by ID.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description:
            'The ID of the channel you want to remove from using predictions.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
  ],
  dm_permission: false,
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

      guildConfiguration.predictionChannelIds.push(channel.id)

      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Admin Channel Setup - Add',
            `Channel ${channel} has been successfully set for using predictions.`
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
              `Channel with ID ${channelId} is not set for predictions.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.predictionChannelIds =
        guildConfiguration.predictionChannelIds.filter((id) => id !== channelId)

      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Admin Channel Setup - Remove',
            `Channel with ID ${channelId} has been successfully removed from using predictions.`
          ),
        ],
      })
    }
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
