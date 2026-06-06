import { isGlobalFeatureDisabled } from 'gambling-bot-shared'

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
  forceCreateUser,
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
  name: 'force-register',
  description: 'Force register a user.',
  options: [
    {
      name: 'user',
      description: 'The user you want to register.',
      type: ApplicationCommandOptionType.User,
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

    if (!guildConfig?.atmChannelIds.logs) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Logs Not Set Up',
            'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.'
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

    const user = interaction.options.getUser('user', true)

    const createdUser = await forceCreateUser({
      userId: user.id,
      guildId: interaction.guildId!
    })

    if (!createdUser) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'ATM Error - Already Registered',
            'User is already registered in the system.'
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

    sendableLogChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('ATM - User Registered')
          .setDescription(
            `Manager <@${interaction.user.id}> has successfully registered <@${user.id}>.`
          )
          .setColor('Grey')
      ]
    })

    logger.event(
      {
        action: 'force_register',
        actorId: interaction.user.id,
        targetUserId: user.id,
        guildId: interaction.guildId
      },
      'Admin force-registered user'
    )

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM Success - Registered',
          'The user has been successfully registered in the system.'
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
