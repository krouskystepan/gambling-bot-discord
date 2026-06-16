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
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

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
      const channel = interaction.options.getChannel('channel', true)

      if (guildConfiguration.casinoChannelIds.includes(channel.id)) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Casino Channel Setup - Add',
              `The channel ${channel} is already configured for casino betting commands.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      guildConfiguration.casinoChannelIds.push(channel.id)
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Casino Channel Setup - Add',
            `The channel ${channel} has been successfully set up for casino betting commands.`
          )
        ]
      })
    }

    if (subcommand === 'remove') {
      const channelId = options.getString('channel-id', true)

      if (!guildConfiguration.casinoChannelIds.includes(channelId)) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Casino Channel Setup - Remove',
              `The channel with ID ${channelId} is not set up for casino betting commands.`
            )
          ],
          flags: MessageFlags.Ephemeral
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
          )
        ]
      })
    }

    if (subcommand === 'add-announcements') {
      const channel = interaction.options.getChannel('channel', true)

      if (guildConfiguration.winAnnouncementsChannelId === channel.id) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Win Announcements Setup - Add',
              `Channel ${channel} is already set for big-win announcements.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      guildConfiguration.winAnnouncementsChannelId = channel.id
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Win Announcements Setup - Add',
            `Channel ${channel} has been set for public big-win announcements.`
          )
        ]
      })
    }

    if (subcommand === 'remove-announcements') {
      const channelId = options.getString('channel-id', true)

      if (guildConfiguration.winAnnouncementsChannelId !== channelId) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Win Announcements Setup - Remove',
              `Channel with ID ${channelId} is not set for big-win announcements.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      guildConfiguration.winAnnouncementsChannelId = ''
      await guildConfiguration.save()

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Win Announcements Setup - Remove',
            `Channel with ID ${channelId} has been removed from big-win announcements.`
          )
        ]
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
