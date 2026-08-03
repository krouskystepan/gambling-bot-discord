import {
  ButtonInteraction,
  MessageComponentInteraction,
  MessageFlags,
  ModalSubmitInteraction
} from 'discord.js'

import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export type ButtonErrorContext = {
  handler: string
  customId?: string
}

export const handleUnexpectedButtonError = async (
  interaction:
    | ButtonInteraction
    | MessageComponentInteraction
    | ModalSubmitInteraction,
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
      'Error - Unexpected error',
      'Something went wrong. Please try again later.'
    )
  ]

  try {
    if (!interaction.isRepliable()) return

    // After deferUpdate(), editReply would overwrite the game message.
    // Always surface handler failures as ephemeral follow-ups / replies.
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        embeds,
        flags: MessageFlags.Ephemeral
      })
      return
    }

    await interaction.reply({
      embeds,
      flags: MessageFlags.Ephemeral
    })
  } catch {
    // Interaction may have expired; error is already logged.
  }
}
