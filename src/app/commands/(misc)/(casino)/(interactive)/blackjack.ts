import { emptySessionStats } from 'gambling-bot-shared/casino'
import { generateId } from 'gambling-bot-shared/common'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertCasinoGameEnabled,
  checkCasinoChannels,
  checkUserRegistration,
  getBlackjackGameByUserAndGuild,
  showBalanceOption,
  skipAnimationsOption,
  upsertBlackjackGame
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import {
  renderBlackjackBettingComponents,
  renderBlackjackBettingEmbed
} from '@/utils/casino/blackjack'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'blackjack',
  description: 'Open a Blackjack table - set your bet, then deal!',
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
        !(await assertCasinoGameEnabled(interaction, guildConfig, 'blackjack'))
      ) {
        return
      }

      const existingGame = await getBlackjackGameByUserAndGuild({
        userId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (existingGame) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Blackjack Already Active',
              'You already have an active Blackjack game running! 🃏'
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

      const gameId = generateId('blackjack')

      const message = await interaction.editReply({
        embeds: [
          renderBlackjackBettingEmbed({
            gameId,
            bet: null,
            globalSettings: guildConfig.globalSettings
          })
        ],
        components: renderBlackjackBettingComponents({
          gameId,
          showBalance,
          hasBet: false
        })
      })

      await upsertBlackjackGame({
        userId: user.userId,
        guildId: user.guildId,
        channelId: interaction.channelId,
        messageId: message.id,
        gameId,
        activeBetId: null,
        baseBetAmount: null,
        showBalance,
        skipAnimations,
        sessionStats: emptySessionStats(),
        deck: [],
        deckIndex: 0,
        hands: [],
        activeHandIndex: -1,
        phase: 'BETTING',
        dealerCards: []
      })
    } catch (error) {
      await handleUnexpectedInteractionError(interaction, error)
    }
  })
}
