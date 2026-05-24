import {
  ButtonInteraction,
  MessageComponentInteraction,
  MessageFlags
} from 'discord.js'

import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export type ButtonErrorContext = {
  handler: string
  customId?: string
}

export const handleUnexpectedButtonError = async (
  interaction: ButtonInteraction | MessageComponentInteraction,
  error: unknown,
  context: ButtonErrorContext
): Promise<void> => {
  logger.error(
    {
      err: error,
      handler: context.handler,
      customId: context.customId ?? interaction.customId,
      userId: interaction.user.id,
      guildId: interaction.guildId
    },
    'Unexpected button interaction error'
  )

  const embeds = [
    createErrorEmbed(
      'Unexpected error',
      'Something went wrong. Please try again later.'
    )
  ]

  try {
    if (interaction.replied || interaction.deferred) {
      if (interaction.isMessageComponent()) {
        await interaction.editReply({ embeds })
      }
      return
    }

    if (interaction.isRepliable()) {
      await interaction.reply({
        embeds,
        flags: MessageFlags.Ephemeral
      })
    }
  } catch {
    // Interaction may have expired; error is already logged.
  }
}
