import type { HiloGuess } from 'gambling-bot-shared/casino'

import type { Interaction } from 'discord.js'

import { handleUnexpectedButtonError } from '@/errors'
import { getGuildConfigByGuildId, getHiloGameByGameId } from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import { replyEphemeralError } from '@/utils/casino/betValidationReply'
import { decodeHiloId, settleHiloGuess } from '@/utils/casino/hilo'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
import { deferComponentUpdate } from '@/utils/discord/deferComponentUpdate'

export const handleHiloInteraction = async (interaction: Interaction) => {
  if (!interaction.isButton()) return
  if (!interaction.customId.startsWith('hl:')) return

  return runWithQuestNotifyInteraction(interaction, async () => {
    const buttonData = decodeHiloId(interaction.customId)
    if (!buttonData) return

    const guildId = interaction.guildId
    if (!guildId) return

    try {
      if (!(await deferComponentUpdate(interaction))) return

      const guildConfig = await getGuildConfigByGuildId({ guildId })
      if (!guildConfig) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Missing Config',
            'Casino settings could not be loaded.'
          )
        ])
        return
      }

      const game = await getHiloGameByGameId({
        gameId: buttonData.gameId,
        guildId
      })

      if (!game || game.status !== 'WAITING') {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Invalid Game',
            'This Hi-Lo round is no longer active.'
          )
        ])
        return
      }

      if (interaction.user.id !== game.userId) {
        await replyEphemeralError(interaction, [
          createErrorEmbed(
            'Error - Not Your Game',
            'Only the player who started this round can guess.'
          )
        ])
        return
      }

      const message =
        interaction.message && 'edit' in interaction.message
          ? interaction.message
          : null

      await settleHiloGuess({
        game,
        guess: buttonData.guess as HiloGuess,
        guildConfig,
        guild: interaction.guild,
        sourceChannelId: interaction.channelId,
        message
      })
    } catch (error) {
      await handleUnexpectedButtonError(interaction, error, {
        handler: 'handleHilo'
      })
    }
  })
}
