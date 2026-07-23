import {
  USER_BANNED_ERROR,
  USER_BANNED_MESSAGE,
  isUserBanned
} from 'gambling-bot-shared/user'

import { Interaction, MessageFlags } from 'discord.js'

import { handleUnexpectedButtonError } from '@/errors'
import {
  deleteBaccaratGame,
  getBaccaratGameByBetId,
  getGuildConfigByGuildId,
  getUser
} from '@/services'
import { decodeId } from '@/utils/casino/baccarat/customId'
import { playBaccaratSide } from '@/utils/casino/baccarat/playRound'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export default async (interaction: Interaction) => {
  if (!interaction.isButton()) return

  const data = decodeId(interaction.customId)
  if (!data) return

  const { betId, side, showBalance, skipAnimations } = data
  const guildId = interaction.guildId
  if (!guildId) return

  try {
    const guildConfig = await getGuildConfigByGuildId({ guildId })
    if (!guildConfig) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Missing Config',
            'Guild casino configuration was not found.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const game = await getBaccaratGameByBetId({ betId, guildId })

    if (!game) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Invalid Game',
            'This game no longer exists.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({
        embeds: [createErrorEmbed('Invalid Input', 'This is not your game.')],
        flags: MessageFlags.Ephemeral
      })
    }

    const user = await getUser({
      userId: game.userId,
      guildId
    })

    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Missing User',
            'Your casino profile was not found.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (isUserBanned(user)) {
      return interaction.reply({
        embeds: [createErrorEmbed(USER_BANNED_ERROR, USER_BANNED_MESSAGE)],
        flags: MessageFlags.Ephemeral
      })
    }

    await interaction.deferUpdate()

    // Remove session first so a double-click cannot settle twice.
    await deleteBaccaratGame({
      userId: game.userId,
      guildId: game.guildId
    })

    await playBaccaratSide({
      message: interaction.message,
      side,
      userId: game.userId,
      guildId: game.guildId,
      betId: game.betId,
      betAmount: game.betAmount,
      showBalance: showBalance || game.showBalance,
      skipAnimations: skipAnimations || game.skipAnimations,
      winMultipliers: guildConfig.casinoSettings.baccarat.winMultipliers,
      globalSettings: guildConfig.globalSettings,
      guild: interaction.guild,
      guildConfig,
      sourceChannelId: interaction.channelId
    })
  } catch (error) {
    await handleUnexpectedButtonError(interaction, error, {
      handler: 'handleBaccarat'
    })
  }
}
