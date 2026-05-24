import { MessageFlags } from 'discord.js'

import { ChatInputCommand } from 'commandkit'

import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const handleUnexpectedInteractionError = async (
  interaction: Parameters<ChatInputCommand>[0]['interaction'],
  error: unknown
) => {
  logger.error(
    {
      err: error,
      command: interaction.commandName,
      userId: interaction.user.id,
      guildId: interaction.guildId
    },
    'Unexpected interaction error'
  )

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
