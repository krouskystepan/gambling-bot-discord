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
  name: 'setup-transaction',
  description: 'Manage the transaction channel.',
  options: [
    {
      name: 'add',
      description: 'Set a channel for transactions.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The channel you want to set for transactions.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true,
        },
      ],
    },
    {
      name: 'remove',
      description: 'Remove a channel from transactions using its ID.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description:
            'The ID of the channel you want to remove from transactions.',
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
  deleted: true,
  devOnly: true,
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

      if (guildConfiguration.transactionChannelId === channel.id) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Transaction Channel Setup - Add',
              `Channel ${channel} is already configured for transactions.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.transactionChannelId = channel.id
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Transaction Channel Setup - Add',
            `Channel ${channel} has been successfully added for transactions.`
          ),
        ],
      })
    }

    if (subcommand === 'remove') {
      const channelId = options.getString('channel-id', true)

      if (guildConfiguration.transactionChannelId !== channelId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Transaction Channel Setup - Remove',
              `Channel with ID ${channelId} is not set for transactions.`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      guildConfiguration.transactionChannelId = ''
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Transaction Channel Setup - Remove',
            `Channel with ID ${channelId} has been successfully removed from transactions.`
          ),
        ],
      })
    }
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
