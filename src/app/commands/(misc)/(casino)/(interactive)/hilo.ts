import { emptySessionStats } from 'gambling-bot-shared/casino'
import { generateId } from 'gambling-bot-shared/common'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertCasinoGameEnabled,
  checkCasinoChannels,
  checkUserRegistration,
  getHiloGameByUserAndGuild,
  showBalanceOption,
  skipAnimationsOption,
  upsertHiloGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  renderHiloBettingComponents,
  renderHiloBettingEmbed
} from '@/utils/casino/hilo'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'hilo',
  description: 'Open a Hi-Lo table - set your bet, then deal!',
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

      if (!(await assertCasinoGameEnabled(interaction, guildConfig, 'hilo'))) {
        return
      }

      const existingGame = await getHiloGameByUserAndGuild({
        userId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (existingGame) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Hi-Lo Already Active',
              'You already have an active Hi-Lo table running! 🃏'
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

      const gameId = generateId('hilo')
      const hiloSettings = guildConfig.casinoSettings.hilo

      const message = await interaction.editReply({
        embeds: [
          renderHiloBettingEmbed({
            gameId,
            bet: null,
            globalSettings: guildConfig.globalSettings
          })
        ],
        components: renderHiloBettingComponents({
          gameId,
          hasBet: false
        })
      })

      await upsertHiloGame({
        userId: user.userId,
        guildId: user.guildId,
        channelId: interaction.channelId,
        messageId: message.id,
        gameId,
        activeBetId: null,
        betAmount: null,
        firstCard: null,
        remainingDeck: [],
        houseEdgeSnapshot: hiloSettings.houseEdge,
        showBalance,
        skipAnimations,
        status: 'BETTING',
        sessionStats: emptySessionStats()
      })
    } catch (error) {
      await handleUnexpectedInteractionError(interaction, error)
    }
  })
}
