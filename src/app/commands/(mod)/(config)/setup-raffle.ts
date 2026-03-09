import {
  ApplicationCommandOptionType,
  ChannelType,
  MessageFlags
} from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { createGuildConfiguration, getGuildConfigByGuildId } from '@/services'
import { DEV_GUILDS } from '@/utils/devGuilds'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'setup-raffle',
  description: 'Manage channels for raffles (actions & logs).',
  options: [
    {
      name: 'add-actions',
      description: 'Add a channel where raffles can be used.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The channel to add for raffle actions.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true
        }
      ]
    },
    {
      name: 'remove-actions',
      description: 'Remove a channel from raffle actions.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description: 'The ID of the channel to remove from raffle actions.',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'add-logs',
      description: 'Set a channel for raffle logs (results).',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The channel to set as raffle logs.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true
        }
      ]
    },
    {
      name: 'remove-logs',
      description: 'Remove the raffle logs channel.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description: 'The ID of the channel to remove from raffle logs.',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  guilds: DEV_GUILDS
}

export const chatInput: ChatInputCommand = async (ctx) => {
  const { interaction } = ctx

  try {
    let guildConfiguration = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    if (!guildConfiguration) {
      guildConfiguration = await createGuildConfiguration({
        guildId: interaction.guildId!
      })
    }

    const options = interaction.options
    const subcommand = options.getSubcommand()

    if (subcommand === 'add-actions') {
      const channel = options.getChannel('channel', true)

      if (guildConfiguration.raffleChannelIds.actions === channel.id) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Raffle Channel Setup - Add Actions',
              `Channel ${channel} is already set for raffle actions.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      guildConfiguration.raffleChannelIds.actions = channel.id
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Raffle Channel Setup - Add Actions',
            `Channel ${channel} has been successfully set for raffle actions.`
          )
        ]
      })
    }

    if (subcommand === 'remove-actions') {
      const channelId = options.getString('channel-id', true)

      if (guildConfiguration.raffleChannelIds.actions !== channelId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Raffle Channel Setup - Remove Actions',
              `Channel with ID ${channelId} is not set for raffle actions.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      guildConfiguration.raffleChannelIds.actions = ''
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Raffle Channel Setup - Remove Actions',
            `Channel with ID ${channelId} has been removed from raffle actions.`
          )
        ]
      })
    }

    if (subcommand === 'add-logs') {
      const channel = options.getChannel('channel', true)

      if (guildConfiguration.raffleChannelIds.logs === channel.id) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Raffle Channel Setup - Add Logs',
              `Channel ${channel} is already set for raffle logs.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      guildConfiguration.raffleChannelIds.logs = channel.id
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Raffle Channel Setup - Add Logs',
            `Channel ${channel} has been successfully set for raffle logs.`
          )
        ]
      })
    }

    if (subcommand === 'remove-logs') {
      const channelId = options.getString('channel-id', true)

      if (guildConfiguration.raffleChannelIds.logs !== channelId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Raffle Channel Setup - Remove Logs',
              `Channel with ID ${channelId} is not set for raffle logs.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      guildConfiguration.raffleChannelIds.logs = ''
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Raffle Channel Setup - Remove Logs',
            `Channel with ID ${channelId} has been removed from raffle logs.`
          )
        ]
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
