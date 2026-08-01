import {
  formatMoney,
  generateId,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkCasinoChannels,
  checkUserRegistration,
  getBlackjackGameByUserAndGuild,
  getUser
} from '@/services'
import { runWithQuestNotifyInteraction } from '@/services/quests'
import { startBlackjackHand } from '@/utils/casino/blackjack'
import { checkValidBet } from '@/utils/common/utils'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'blackjack',
  description: 'Start a game of blackjack. You can hit, stand, or double down.',
  options: [
    {
      name: 'bet',
      description: 'Place a bet (e.g., 1000, 2k, 4.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'show-balance',
      description:
        'Displays the current balance (WARNING: VISIBLE TO EVERYONE)!',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    }
  ],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  return runWithQuestNotifyInteraction(interaction, async () => {
    try {
      const user = await checkUserRegistration({ interaction })
      if (!user) return

      const configReply = await checkCasinoChannels(interaction)
      if (!configReply) return

      const existingGame = await getBlackjackGameByUserAndGuild({
        userId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (existingGame) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Error - Blackjack Already Active',
              `You already have an active Blackjack game running! 🃏`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const betAmount = interaction.options.getString('bet', true)
      const parsedBetAmount = parseReadableStringToNumber(betAmount)
      const showBalance =
        interaction.options.getBoolean('show-balance') || false

      const isBetValid = checkValidBet(
        interaction,
        parsedBetAmount,
        configReply.casinoSettings.blackjack.maxBet,
        configReply.casinoSettings.blackjack.minBet,
        configReply.globalSettings
      )

      if (!isBetValid) return

      await interaction.deferReply()

      const message = await interaction.fetchReply()

      try {
        const hand = await startBlackjackHand({
          userId: user.userId,
          guildId: user.guildId,
          gameId: generateId('blackjack'),
          channelId: interaction.channelId,
          messageId: message.id,
          betAmount: parsedBetAmount,
          showBalance,
          guildConfig: configReply,
          guild: interaction.guild,
          sourceChannelId: interaction.channelId
        })

        await interaction.editReply({
          embeds: hand.embeds,
          components: hand.components
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'INSUFFICIENT_FUNDS') {
          const freshUser = await getUser({
            userId: user.userId,
            guildId: user.guildId
          })

          return await interaction.editReply({
            embeds: [
              createErrorEmbed(
                'Error - Insufficient Funds',
                `You don't have enough money to place this bet.\nYour current balance is **${formatMoney(freshUser?.balance ?? 0, configReply.globalSettings)}**.`
              )
            ]
          })
        }
        throw err
      }
    } catch (error) {
      await handleUnexpectedInteractionError(interaction, error)
    }
  })
}
