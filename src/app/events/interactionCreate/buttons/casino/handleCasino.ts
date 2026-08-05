import type { Interaction } from 'discord.js'

import { handleBaccaratInteraction } from '@/utils/casino/interactions/handleBaccarat'
import { handleBlackjackInteraction } from '@/utils/casino/interactions/handleBlackjack'
import { handleHiloInteraction } from '@/utils/casino/interactions/handleHilo'
import { handleMinesInteraction } from '@/utils/casino/interactions/handleMines'
import { handlePlinkoInteraction } from '@/utils/casino/interactions/handlePlinko'
import { handleRouletteInteraction } from '@/utils/casino/interactions/handleRoulette'
import { handleSlotsInteraction } from '@/utils/casino/interactions/handleSlots'

/**
 * Single casino entrypoint so CommandKit does not race five handlers on the
 * same interaction (Discord's ~3s ack window).
 */
export const parallel = true

export default async (interaction: Interaction) => {
  if (
    !interaction.isButton() &&
    !interaction.isStringSelectMenu() &&
    !interaction.isModalSubmit()
  ) {
    return
  }

  const customId = interaction.customId

  if (customId.startsWith('pk:') || customId.startsWith('pkm:')) {
    return handlePlinkoInteraction(interaction)
  }
  if (customId.startsWith('sl:') || customId.startsWith('slm:')) {
    return handleSlotsInteraction(interaction)
  }
  if (customId.startsWith('rl:') || customId.startsWith('rlm:')) {
    return handleRouletteInteraction(interaction)
  }
  if (customId.startsWith('bj:') || customId.startsWith('bjm:')) {
    return handleBlackjackInteraction(interaction)
  }
  if (customId.startsWith('bc:') || customId.startsWith('bcm:')) {
    return handleBaccaratInteraction(interaction)
  }
  if (customId.startsWith('mines:') || customId.startsWith('minesm:')) {
    return handleMinesInteraction(interaction)
  }
  if (customId.startsWith('hl:') || customId.startsWith('hlm:')) {
    return handleHiloInteraction(interaction)
  }
}
