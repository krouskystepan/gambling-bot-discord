import {
  ApplicationCommandOptionType,
  ChannelType,
  MessageFlags
} from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertModMaintenanceAllowed,
  createGuildConfiguration,
  getGuildConfigByGuildId
} from '@/services'
import { DEV_GUILDS } from '@/utils/devGuilds'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'setup-worker-logs',
  description: 'Manage the background worker logs channel.',
  options: [
    {
      name: 'add',
      description: 'Set a channel for background worker activity summaries.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The channel you want to set.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true
        }
      ]
    },
    {
      name: 'remove',
      description: 'Remove the worker logs channel using its ID.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description: 'The ID of the channel you want to remove.',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'status',
      description: 'Show the current worker logs channel.',
      type: ApplicationCommandOptionType.Subcommand
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  guilds: DEV_GUILDS
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    let guildConfiguration = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    if (!guildConfiguration) {
      guildConfiguration = await createGuildConfiguration({
        guildId: interaction.guildId!
      })
    } else if (
      (await assertModMaintenanceAllowed(interaction, interaction.guildId!)) ===
      false
    ) {
      return
    }

    const options = interaction.options
    const subcommand = options.getSubcommand()

    if (subcommand === 'add') {
      const channel = options.getChannel('channel', true)

      guildConfiguration.workerLogChannelId = channel.id
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Worker Logs Channel Setup - Add',
            `Channel ${channel} has been successfully set for background worker logs.`
          )
        ]
      })
    }

    if (subcommand === 'remove') {
      const channelId = options.getString('channel-id', true)

      if (guildConfiguration.workerLogChannelId !== channelId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Worker Logs Channel Setup - Remove',
              `Channel with ID ${channelId} is not set for worker logs.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      guildConfiguration.workerLogChannelId = ''
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Worker Logs Channel Setup - Remove',
            `Channel with ID ${channelId} has been successfully removed from worker logs.`
          )
        ]
      })
    }

    if (subcommand === 'status') {
      const channelId = guildConfiguration.workerLogChannelId

      if (!channelId) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Worker Logs Channel Setup - Status',
              'Worker logs are **not configured**. Background worker activity is not sent to Discord.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const channel = await interaction
        .guild!.channels.fetch(channelId)
        .catch(() => null)

      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Worker Logs Channel Setup - Status',
            channel
              ? `Worker logs are configured in ${channel}.`
              : `Worker logs are configured for channel ID \`${channelId}\` (channel not found in cache).`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
