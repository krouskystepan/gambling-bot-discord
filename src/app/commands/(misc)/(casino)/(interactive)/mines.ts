import { emptySessionStats } from 'gambling-bot-shared/casino'
import { generateId } from 'gambling-bot-shared/common'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertCasinoGameEnabled,
  checkCasinoChannels,
  checkUserRegistration,
  getMinesGameByUserAndGuild,
  showBalanceOption,
  upsertMinesGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  renderMinesSetupComponents,
  renderMinesSetupEmbed
} from '@/utils/casino/mines'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'mines',
  description: 'Open a Mines table - set your bet and mines, then start!',
  options: [showBalanceOption],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  return runWithQuestNotifyInteraction(interaction, async () => {
    try {
      const user = await checkUserRegistration({ interaction })
      if (!user) return

      const guildConfig = await checkCasinoChannels(interaction)
      if (!guildConfig) return

      if (!(await assertCasinoGameEnabled(interaction, guildConfig, 'mines'))) {
        return
      }

      const existingGame = await getMinesGameByUserAndGuild({
        userId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (existingGame) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Mines Already Active',
              'You already have an active Mines game running! 💣'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const showBalance =
        interaction.options.getBoolean('show-balance') || false

      await interaction.deferReply()

      const gameId = generateId('mines')

      const message = await interaction.editReply({
        embeds: [
          renderMinesSetupEmbed({
            gameId,
            betAmount: null,
            mineCount: null,
            globalSettings: guildConfig.globalSettings
          })
        ],
        components: renderMinesSetupComponents({
          gameId,
          showBalance,
          canStart: false
        })
      })

      await upsertMinesGame({
        userId: user.userId,
        guildId: user.guildId,
        channelId: interaction.channelId,
        messageId: message.id,
        gameId,
        activeBetId: null,
        betAmount: null,
        mineCount: null,
        mineIndices: [],
        revealedIndices: [],
        houseEdgeSnapshot: guildConfig.casinoSettings.mines.houseEdge,
        status: 'SETUP',
        showBalance,
        sessionStats: emptySessionStats()
      })
    } catch (error) {
      await handleUnexpectedInteractionError(interaction, error)
    }
  })
}
