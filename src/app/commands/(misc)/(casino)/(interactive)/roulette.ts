import { generateId } from 'gambling-bot-shared/common'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  getRouletteGameByUserAndGuild,
  showBalanceOption,
  skipAnimationsOption,
  upsertRouletteGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  renderRouletteComponents,
  renderRouletteTableEmbed
} from '@/utils/casino/roulette'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'roulette',
  description: 'Open a Mini Roulette table - place bets, then spin!',
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

      const existingGame = await getRouletteGameByUserAndGuild({
        userId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (existingGame) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Roulette Already Active',
              'You already have an open roulette table! Close it or finish that game first. 🌀'
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

      const gameId = generateId('roulette')

      const message = await interaction.editReply({
        embeds: [
          renderRouletteTableEmbed({
            gameId,
            bets: [],
            phase: 'betting',
            showBalance,
            globalSettings: guildConfig.globalSettings
          })
        ],
        components: renderRouletteComponents({
          gameId,
          phase: 'betting',
          hasBets: false,
          hasLastBets: false
        })
      })

      await upsertRouletteGame({
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
