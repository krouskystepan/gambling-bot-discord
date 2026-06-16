import { isGlobalFeatureDisabled } from 'gambling-bot-shared/guild'

import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  GuildTextBasedChannel,
  MessageFlags
} from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertModMaintenanceAllowed,
  forceDeleteUser,
  getGuildConfigByGuildId
} from '@/services'
import { DEV_GUILDS } from '@/utils/devGuilds'
import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
  name: 'force-unregister',
  description: 'Unregister a user (delete from DB).',
  options: [
    {
      name: 'user-id',
      description: 'The ID of the user you want to unregister.',
      type: ApplicationCommandOptionType.String,
      required: true
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
    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    if (!guildConfig?.atmChannelIds?.logs) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Logs Not Set Up',
            'ATM logs are not configured yet.\nPlease contact an administrator.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }
    if (
      (await assertModMaintenanceAllowed(interaction, interaction.guildId!)) ===
      false
    ) {
      return
    }

    if (isGlobalFeatureDisabled(guildConfig, 'registration')) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Feature Disabled',
            'New user registration is disabled on this server.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const userId = interaction.options.getString('user-id', true)

    const deletedUser = await forceDeleteUser({
      userId,
      guildId: interaction.guildId!
    })

    if (!deletedUser) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'ATM Error - Not Registered',
            'User is not registered in the system.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const logChannel = await interaction
      .guild!.channels.fetch(guildConfig.atmChannelIds.logs)
      .catch(() => null)

    if (!isGuildSendableChannel(logChannel)) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Wrong Discord Configuration',
            'Log channel misconfigured or inaccessible.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const sendableLogChannel = logChannel as GuildTextBasedChannel

    await sendableLogChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('ATM - User Unregistered')
          .setDescription(
            `Manager <@${interaction.user.id}> has unregistered <@${userId}>.`
          )
          .setColor('NotQuiteBlack')
      ]
    })

    logger.event(
      {
        action: 'force_unregister',
        actorId: interaction.user.id,
        targetUserId: userId,
        guildId: interaction.guildId
      },
      'Admin force-unregistered user'
    )

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM Success - Unregistered',
          `The user <@${userId}> has been successfully unregistered.`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
