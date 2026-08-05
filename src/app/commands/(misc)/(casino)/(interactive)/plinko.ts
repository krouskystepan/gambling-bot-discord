import { generateId } from 'gambling-bot-shared/common'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertCasinoGameEnabled,
  checkCasinoChannels,
  checkUserRegistration,
  getPlinkoGameByUserAndGuild,
  showBalanceOption,
  skipAnimationsOption,
  upsertPlinkoGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  renderPlinkoBoardEmbed,
  renderPlinkoComponents
} from '@/utils/casino/plinko'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'plinko',
  description: 'Open a Plinko board - set your bet, then drop!',
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

      if (
        !(await assertCasinoGameEnabled(interaction, guildConfig, 'plinko'))
      ) {
        return
      }

      const existingGame = await getPlinkoGameByUserAndGuild({
        userId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (existingGame) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Plinko Already Active',
              'You already have an open Plinko board! Close it or finish that game first. 🎯'
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

      const gameId = generateId('plinko')

      const message = await interaction.editReply({
        embeds: [
          renderPlinkoBoardEmbed({
            gameId,
            phase: 'ready',
            unitBet: null,
            showBalance,
            globalSettings: guildConfig.globalSettings,
            binMultipliers: guildConfig.casinoSettings.plinko.binMultipliers
          })
        ],
        components: renderPlinkoComponents({
          gameId,
          phase: 'ready',
          hasUnitBet: false
        })
      })

      await upsertPlinkoGame({
        userId: user.userId,
        guildId: user.guildId,
        channelId: interaction.channelId,
        messageId: message.id,
        gameId,
        showBalance,
        skipAnimations
      })
    } catch (error) {
      await handleUnexpectedInteractionError(interaction, error)
    }
  })
}
