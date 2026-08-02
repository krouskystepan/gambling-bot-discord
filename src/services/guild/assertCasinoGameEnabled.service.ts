import {
  CasinoGameId,
  isCasinoGameEnabled,
  readableGameNames
} from 'gambling-bot-shared/casino'
import { getReadableName } from 'gambling-bot-shared/common'
import { TGuildConfiguration } from 'gambling-bot-shared/guild'

import { MessageFlags } from 'discord.js'

import { createErrorEmbed } from '@/utils/discord/createEmbed'

import type { RepliableInteractionLike } from './checkGlobalFeature.service'

export const assertCasinoGameEnabled = async (
  interaction: RepliableInteractionLike,
  config: TGuildConfiguration,
  gameId: CasinoGameId
): Promise<boolean> => {
  if (isCasinoGameEnabled(config.casinoSettings, gameId)) return true

  const gameName = getReadableName(gameId, readableGameNames)
  const payload = {
    embeds: [
      createErrorEmbed(
        'Error - Feature Disabled',
        `${gameName} is disabled on this server.`
      )
    ],
    flags: MessageFlags.Ephemeral
  }

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(payload)
  } else {
    await interaction.reply(payload)
  }

  return false
}
