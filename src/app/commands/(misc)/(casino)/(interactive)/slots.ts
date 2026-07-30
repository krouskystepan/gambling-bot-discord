import { generateId } from 'gambling-bot-shared/common'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  getSlotsGameByUserAndGuild,
  showBalanceOption,
  skipAnimationsOption,
  upsertSlotsGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  renderSlotsComponents,
  renderSlotsMachineEmbed
} from '@/utils/casino/slots'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'slots',
  description: 'Open a live slots machine - set your chip, then spin!',
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

      const existingGame = await getSlotsGameByUserAndGuild({
        userId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (existingGame) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Slots Already Active',
              'You already have an open slots machine! Close it or finish that game first. 🎰'
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

      const gameId = generateId()

      const message = await interaction.editReply({
        embeds: [
          renderSlotsMachineEmbed({
            gameId,
            phase: 'ready',
            unitBet: null,
            spinsCount: 1,
            showBalance,
            globalSettings: guildConfig.globalSettings
          })
        ],
        components: renderSlotsComponents({
          gameId,
          phase: 'ready',
          hasUnitBet: false,
          spinsCount: 1
        })
      })

      await upsertSlotsGame({
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
