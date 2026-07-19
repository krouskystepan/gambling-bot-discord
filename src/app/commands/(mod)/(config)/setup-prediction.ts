import { ApplicationCommandOptionType, ChannelType } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  handleChannelSetup,
  resolveGuildConfigurationForSetup
} from '@/services'
import { DEV_GUILDS } from '@/utils/devGuilds'

export const command: CommandData = {
  name: 'setup-prediction',
  description: 'Manage channels for predictions (actions & logs).',
  options: [
    {
      name: 'add-actions',
      description: 'Add a channel where predictions can be used.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The channel to add for prediction actions.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true
        }
      ]
    },
    {
      name: 'remove-actions',
      description: 'Remove a channel from prediction actions.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description:
            'The ID of the channel to remove from prediction actions.',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'add-logs',
      description: 'Set a channel for prediction logs (results).',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The channel to set as prediction logs.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true
        }
      ]
    },
    {
      name: 'remove-logs',
      description: 'Remove the prediction logs channel.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description: 'The ID of the channel to remove from prediction logs.',
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
          get: (config) => config.predictionChannelIds.actions,
          set: (config, channelId) => {
            config.predictionChannelIds.actions = channelId
          },
          clear: (config) => {
            config.predictionChannelIds.actions = ''
          }
        },
        messages: {
          titleAdd: 'Prediction Channel Setup - Add Actions',
          titleRemove: 'Prediction Channel Setup - Remove Actions',
          alreadySet: (channel) =>
            `Channel ${channel} is already set for prediction actions.`,
          addSuccess: (channel) =>
            `Channel ${channel} has been successfully set for prediction actions.`,
          notSet: (channelId) =>
            `Channel with ID ${channelId} is not set for prediction actions.`,
          removeSuccess: (channelId) =>
            `Channel with ID ${channelId} has been removed from prediction actions.`
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
          get: (config) => config.predictionChannelIds.logs,
          set: (config, channelId) => {
            config.predictionChannelIds.logs = channelId
          },
          clear: (config) => {
            config.predictionChannelIds.logs = ''
          }
        },
        messages: {
          titleAdd: 'Prediction Channel Setup - Add Logs',
          titleRemove: 'Prediction Channel Setup - Remove Logs',
          alreadySet: (channel) =>
            `Channel ${channel} is already set for prediction logs.`,
          addSuccess: (channel) =>
            `Channel ${channel} has been successfully set for prediction logs.`,
          notSet: (channelId) =>
            `Channel with ID ${channelId} is not set for prediction logs.`,
          removeSuccess: (channelId) =>
            `Channel with ID ${channelId} has been removed from prediction logs.`
        }
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
