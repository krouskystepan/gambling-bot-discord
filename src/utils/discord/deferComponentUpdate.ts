import type { Interaction } from 'discord.js'

const discordErrorCode = (error: unknown): number | null => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'number'
  ) {
    return (error as { code: number }).code
  }
  return null
}

/**
 * Ack a component/modal interaction without throwing when Discord already
 * expired it (10062) or another parallel handler already acknowledged it (40060).
 */
export const deferComponentUpdate = async (
  interaction: Interaction
): Promise<boolean> => {
  if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) {
    return false
  }
  if (interaction.deferred || interaction.replied) return true

  try {
    await interaction.deferUpdate()
    return true
  } catch (error) {
    const code = discordErrorCode(error)

    // Expired / unknown interaction (~3s window).
    if (code === 10062) return false

    // Already acknowledged (parallel interactionCreate listeners raced).
    if (code === 40060 || interaction.deferred || interaction.replied) {
      return true
    }

    throw error
  }
}
