import { ApplicationCommandOptionType, ChannelType } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  handleChannelSetup,
  resolveGuildConfigurationForSetup
} from '@/services'
import { DEV_GUILDS } from '@/utils/devGuilds'

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

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const guildConfiguration =
      await resolveGuildConfigurationForSetup(interaction)
    if (!guildConfiguration) return

    const subcommand = interaction.options.getSubcommand()

    if (subcommand === 'add-actions' || subcommand === 'remove-actions') {
      return handleChannelSetup({
        interaction,
        guildConfiguration,
        op: subcommand === 'add-actions' ? 'add' : 'remove',
        mode: {
          kind: 'scalar',
          get: (config) => config.raffleChannelIds.actions,
          set: (config, channelId) => {
            config.raffleChannelIds.actions = channelId
          },
          clear: (config) => {
            config.raffleChannelIds.actions = ''
          }
        },
        messages: {
          titleAdd: 'Raffle Channel Setup - Add Actions',
          titleRemove: 'Raffle Channel Setup - Remove Actions',
          alreadySet: (channel) =>
            `Channel ${channel} is already set for raffle actions.`,
          addSuccess: (channel) =>
            `Channel ${channel} has been successfully set for raffle actions.`,
          notSet: (channelId) =>
            `Channel with ID ${channelId} is not set for raffle actions.`,
          removeSuccess: (channelId) =>
            `Channel with ID ${channelId} has been removed from raffle actions.`
        }
      })
    }

    if (subcommand === 'add-logs' || subcommand === 'remove-logs') {
      return handleChannelSetup({
        interaction,
        guildConfiguration,
        op: subcommand === 'add-logs' ? 'add' : 'remove',
        mode: {
          kind: 'scalar',
          get: (config) => config.raffleChannelIds.logs,
          set: (config, channelId) => {
            config.raffleChannelIds.logs = channelId
          },
          clear: (config) => {
            config.raffleChannelIds.logs = ''
          }
        },
        messages: {
          titleAdd: 'Raffle Channel Setup - Add Logs',
          titleRemove: 'Raffle Channel Setup - Remove Logs',
          alreadySet: (channel) =>
            `Channel ${channel} is already set for raffle logs.`,
          addSuccess: (channel) =>
            `Channel ${channel} has been successfully set for raffle logs.`,
          notSet: (channelId) =>
            `Channel with ID ${channelId} is not set for raffle logs.`,
          removeSuccess: (channelId) =>
            `Channel with ID ${channelId} has been removed from raffle logs.`
        }
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
