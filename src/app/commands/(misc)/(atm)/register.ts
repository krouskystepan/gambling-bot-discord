import { EmbedBuilder, GuildTextBasedChannel, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { checkAtmChannels, createUserIfNotExists } from '@/services'
import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
  name: 'register',
  description: 'Register yourself in the system.',
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const guildConfiguration = await checkAtmChannels(interaction)
    if (!guildConfiguration) return

    const wasCreated = await createUserIfNotExists({
      userId: interaction.user.id,
      guildId: interaction.guildId!
    })

    if (!wasCreated) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'ATM Error - Registered',
            'You are already registered in the system.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const logChannel = await interaction
      .guild!.channels.fetch(guildConfiguration.atmChannelIds.logs)
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

    sendableLogChannel
      .send({
        embeds: [
          new EmbedBuilder()
            .setTitle('ATM - User Registration')
            .setDescription(
              `User <@${interaction.user.id}> has successfully registered in the system.`
            )
            .setColor('White')
        ]
      })
      .catch((err) => {
        logger.error('Registration failed', err)
      })

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM Success - Registered',
          'You have been successfully registered in the system.'
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
