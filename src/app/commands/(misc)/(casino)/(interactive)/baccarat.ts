import {
  generateId,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  betOption,
  checkCasinoChannels,
  checkUserRegistration,
  getBaccaratGameByUserAndGuild,
  reserveCasinoBet,
  showBalanceOption,
  skipAnimationsOption,
  upsertBaccaratGame
} from '@/services'
import {
  renderBaccaratButtons,
  renderBaccaratPromptEmbed
} from '@/utils/casino/baccarat/render'
import { checkValidBet } from '@/utils/common/utils'
import { createErrorEmbed } from '@/utils/discord/createEmbed'

export const command: CommandData = {
  name: 'baccarat',
  description: 'Play punto banco Baccarat - pick a side, then watch the deal!',
  options: [betOption, showBalanceOption, skipAnimationsOption],
  dm_permission: false
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
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
            'Baccarat Already Active',
            'You already have an active Baccarat game running! 🃏'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const betAmount = parseReadableStringToNumber(
      interaction.options.getString('bet', true)
    )
    const showBalance = interaction.options.getBoolean('show-balance') || false
    const skipAnimations =
      interaction.options.getBoolean('skip-animations') || false

    const isBetValid = checkValidBet(
      interaction,
      betAmount,
      guildConfig.casinoSettings.baccarat.maxBet,
      guildConfig.casinoSettings.baccarat.minBet,
      guildConfig.globalSettings
    )
    if (!isBetValid) return

    await interaction.deferReply()

    const betId = generateId()

    try {
      await reserveCasinoBet({
        userId: user.userId,
        guildId: user.guildId,
        totalBet: betAmount,
        betId,
        game: 'baccarat'
      })
    } catch {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Bet Failed',
            'Not enough balance to place this bet.'
          )
        ]
      })
    }

    const message = await interaction.editReply({
      embeds: [
        renderBaccaratPromptEmbed({
          bet: betAmount,
          winMultipliers: guildConfig.casinoSettings.baccarat.winMultipliers,
          betId,
          globalSettings: guildConfig.globalSettings
        })
      ],
      components: renderBaccaratButtons({
        betId,
        showBalance,
        skipAnimations
      })
    })

    await upsertBaccaratGame({
      userId: user.userId,
      guildId: user.guildId,
      channelId: interaction.channelId,
      messageId: message.id,
      betId,
      betAmount,
      showBalance,
      skipAnimations
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
