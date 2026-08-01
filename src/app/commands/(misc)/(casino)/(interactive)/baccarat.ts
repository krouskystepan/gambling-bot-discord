import { emptySessionStats } from 'gambling-bot-shared/casino'
import { generateId } from 'gambling-bot-shared/common'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  getBaccaratGameByUserAndGuild,
  showBalanceOption,
  skipAnimationsOption,
  upsertBaccaratGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  renderBaccaratButtons,
  renderBaccaratPromptEmbed
} from '@/utils/casino/baccarat'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'baccarat',
  description: 'Open a Baccarat table - set your bet, then pick a side!',
  options: [showBalanceOption, skipAnimationsOption],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  return runWithQuestNotifyInteraction(interaction, async () => {
    try {
      const user = await checkUserRegistration({ interaction })
      if (!user) return

      const guildConfig = await checkCasinoChannels(interaction)
      if (!guildConfig) return

      const existingGame = await getBaccaratGameByUserAndGuild({
        userId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (existingGame) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Baccarat Already Active',
              'You already have an active Baccarat game running! 🃏'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const showBalance =
        interaction.options.getBoolean('show-balance') || false
      const skipAnimations =
        interaction.options.getBoolean('skip-animations') || false

      await interaction.deferReply()

      const gameId = generateId('baccarat')

      // Nothing is reserved until a side is picked, so an idle table can be
      // closed without a refund.
      const message = await interaction.editReply({
        embeds: [
          renderBaccaratPromptEmbed({
            bet: null,
            winMultipliers: guildConfig.casinoSettings.baccarat.winMultipliers,
            gameId,
            globalSettings: guildConfig.globalSettings
          })
        ],
        components: renderBaccaratButtons({ gameId, hasBet: false })
      })

      await upsertBaccaratGame({
        userId: user.userId,
        guildId: user.guildId,
        channelId: interaction.channelId,
        messageId: message.id,
        gameId,
        betAmount: null,
        showBalance,
        skipAnimations,
        phase: 'waiting',
        sessionStats: emptySessionStats()
      })
    } catch (error) {
      await handleUnexpectedInteractionError(interaction, error)
    }
  })
}
