import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ApplicationCommandOptionType,
  ChannelType,
  CommandInteractionOptionResolver,
  MessageFlags,
} from 'discord.js'
import GuildConfiguration from '../../../models/GuildConfiguration'
import { createSuccessEmbed } from '../../../utils/createEmbed'

export const data: CommandData = {
  name: 'setup-casino',
  description: 'Management of casino betting channels.',
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
          required: true,
        },
      ],
    },
    {
      name: 'remove',
      description: 'Remove a channel for using casino bets by ID.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description:
            'The ID of the channel you want to remove from casino bets.',
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

      guildConfiguration.casinoChannelIds.push(channel.id)

      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Casino Channel Setup - Add',
            `The channel ${channel} has been successfully set up for casino betting commands.`
          ),
        ],
      })
    }

    if (subcommand === 'remove') {
      const channelId = options.getString('channel-id', true)

      if (!guildConfiguration.casinoChannelIds.includes(channelId)) {
        return interaction.reply({
          embeds: [
            createSuccessEmbed(
              'Casino Channel Setup - Remove',
              `The channel with ID ${channelId} is not set up for casino betting commands.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.casinoChannelIds =
        guildConfiguration.casinoChannelIds.filter((id) => id !== channelId)

      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Casino Channel Setup - Remove',
            `The channel with ID ${channelId} has been successfully removed from casino betting commands.`
          ),
        ],
      })
    }
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
