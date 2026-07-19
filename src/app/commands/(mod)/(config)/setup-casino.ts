import { ApplicationCommandOptionType, ChannelType } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  handleChannelSetup,
  resolveGuildConfigurationForSetup
} from '@/services'
import { DEV_GUILDS } from '@/utils/devGuilds'

export const command: CommandData = {
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
          description:
            'The ID of the channel you want to remove from casino bets.',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'add-announcements',
      description: 'Set a channel for public big-win announcements.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The channel for Golden Jackpot and Plinko win posts.',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true
        }
      ]
    },
    {
      name: 'remove-announcements',
      description: 'Remove the public big-win announcements channel.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel-id',
          description: 'The ID of the announcements channel to remove.',
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

    if (subcommand === 'add' || subcommand === 'remove') {
      return handleChannelSetup({
        interaction,
        guildConfiguration,
        op: subcommand === 'add' ? 'add' : 'remove',
        mode: {
          kind: 'list',
          get: (config) => config.casinoChannelIds,
          set: (config, channelIds) => {
            config.casinoChannelIds = channelIds
          }
        },
        messages: {
          titleAdd: 'Casino Channel Setup - Add',
          titleRemove: 'Casino Channel Setup - Remove',
          alreadySet: (channel) =>
            `The channel ${channel} is already configured for casino betting commands.`,
          addSuccess: (channel) =>
            `The channel ${channel} has been successfully set up for casino betting commands.`,
          notSet: (channelId) =>
            `The channel with ID ${channelId} is not set up for casino betting commands.`,
          removeSuccess: (channelId) =>
            `The channel with ID ${channelId} has been successfully removed from casino betting commands.`
        }
      })
    }

    if (
      subcommand === 'add-announcements' ||
      subcommand === 'remove-announcements'
    ) {
      return handleChannelSetup({
        interaction,
        guildConfiguration,
        op: subcommand === 'add-announcements' ? 'add' : 'remove',
        mode: {
          kind: 'scalar',
          get: (config) => config.winAnnouncementsChannelId,
          set: (config, channelId) => {
            config.winAnnouncementsChannelId = channelId
          },
          clear: (config) => {
            config.winAnnouncementsChannelId = ''
          }
        },
        messages: {
          titleAdd: 'Win Announcements Setup - Add',
          titleRemove: 'Win Announcements Setup - Remove',
          alreadySet: (channel) =>
            `Channel ${channel} is already set for big-win announcements.`,
          addSuccess: (channel) =>
            `Channel ${channel} has been set for public big-win announcements.`,
          notSet: (channelId) =>
            `Channel with ID ${channelId} is not set for big-win announcements.`,
          removeSuccess: (channelId) =>
            `Channel with ID ${channelId} has been removed from big-win announcements.`
        }
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
