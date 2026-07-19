import { ApplicationCommandOptionType, ChannelType } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  handleChannelSetup,
  resolveGuildConfigurationForSetup
} from '@/services'
import { DEV_GUILDS } from '@/utils/devGuilds'

export const command: CommandData = {
  name: 'setup-atm',
  description: 'Manage ATM actions and logs channels.',
  options: [
    {
      name: 'add-actions',
      description:
        'Set a channel for ATM transactions (deposits and withdrawals).',
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
      name: 'remove-actions',
      description:
        'Remove a channel for ATM transactions using its ID (deposits and withdrawals).',
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
      name: 'add-logs',
      description: 'Set a channel for ATM logs (transaction logs).',
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
      name: 'remove-logs',
      description:
        'Remove a channel for ATM logs using its ID (transaction logs).',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description: 'The ID of the channel you want to remove.',
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
          get: (config) => config.atmChannelIds.actions,
          set: (config, channelId) => {
            config.atmChannelIds.actions = channelId
          },
          clear: (config) => {
            config.atmChannelIds.actions = ''
          }
        },
        messages: {
          titleAdd: 'ATM Actions Channel Setup - Add',
          titleRemove: 'ATM Actions Channel Setup - Remove',
          alreadySet: (channel) =>
            `Channel ${channel} is already set for ATM transactions.`,
          addSuccess: (channel) =>
            `Channel ${channel} has been successfully set for ATM transactions.`,
          notSet: (channelId) =>
            `Channel with ID ${channelId} is not set for ATM transactions.`,
          removeSuccess: (channelId) =>
            `Channel with ID ${channelId} has been successfully removed from ATM transactions.`
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
          get: (config) => config.atmChannelIds.logs,
          set: (config, channelId) => {
            config.atmChannelIds.logs = channelId
          },
          clear: (config) => {
            config.atmChannelIds.logs = ''
          }
        },
        messages: {
          titleAdd: 'ATM Logs Channel Setup - Add',
          titleRemove: 'ATM Logs Channel Setup - Remove',
          alreadySet: (channel) =>
            `Channel ${channel} is already set for ATM logs.`,
          addSuccess: (channel) =>
            `Channel ${channel} has been successfully set for ATM logs.`,
          notSet: (channelId) =>
            `Channel with ID ${channelId} is not set for ATM logs.`,
          removeSuccess: (channelId) =>
            `Channel with ID ${channelId} has been successfully removed from ATM logs.`
        }
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
