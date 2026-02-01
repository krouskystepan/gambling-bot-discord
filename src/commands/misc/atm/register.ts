import { EmbedBuilder, MessageFlags } from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { checkAtmChannels, createUser, getUser } from '@/services'
import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const data: CommandData = {
  name: 'register',
  description: 'Register yourself in the system.',
  dm_permission: false
}

export const options: CommandOptions = {
  deleted: false
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const guildConfiguration = await checkAtmChannels(interaction)
    if (!guildConfiguration) return

    const user = await getUser({
      userId: interaction.user.id,
      guildId: interaction.guildId!
    })

    if (user) {
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

    await createUser({
      userId: interaction.user.id,
      guildId: interaction.guildId!
    })

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

    logChannel
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
