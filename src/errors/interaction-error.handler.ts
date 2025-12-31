import {
  CacheType,
  ChatInputCommandInteraction,
  MessageFlags
} from 'discord.js'

import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const handleUnexpectedInteractionError = async (
  interaction: ChatInputCommandInteraction<CacheType>,
  error: unknown
) => {
  logger.error('Unexpected interaction error', {
    command: interaction.commandName,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    error
  })

  if (interaction.replied || interaction.deferred) return

  await interaction.reply({
    embeds: [
      createErrorEmbed(
        'Unexpected error',
        'Something went wrong. Please try again later.'
      )
    ],
    flags: MessageFlags.Ephemeral
  })
}
