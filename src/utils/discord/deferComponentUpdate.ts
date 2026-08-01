import type { Interaction } from 'discord.js'

/**
 * Ack a component/modal interaction without throwing when Discord already
 * expired it (10062) or another handler already replied.
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
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'number'
        ? (error as { code: number }).code
        : null

    // Unknown interaction - expired (~3s) or already acknowledged.
    if (code === 10062) return false
    throw error
  }
}
