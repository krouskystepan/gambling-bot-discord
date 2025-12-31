import { TGuildConfiguration } from 'gambling-bot-shared'

import { ChatInputCommandInteraction, MessageFlags } from 'discord.js'

import { createErrorEmbed } from '@/utils/discord/createEmbed'

import { getGuildConfigByGuildId } from '../db/guildConfiguration.db'
import { getActiveVipChannels } from '../vip/getActiveVipChannels.service'

export const checkAtmChannels = async (
  interaction: ChatInputCommandInteraction
): Promise<TGuildConfiguration | false> => {
  const config = await getGuildConfigByGuildId({
    guildId: interaction.guildId!
  })

  if (!config) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error - Not Configured',
          'Guild configuration not found.\nPlease contact an administrator.'
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  if (!config.atmChannelIds?.logs || !config.atmChannelIds?.actions) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error - Not Configured',
          'ATM logs or actions are not configured yet.\nPlease contact an administrator.'
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  if (config.atmChannelIds.actions !== interaction.channelId) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error - Incorrect Channel',
          `This command can only be used in <#${config.atmChannelIds.actions}>.`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  return config
}

export const checkCasinoChannels = async (
  interaction: ChatInputCommandInteraction
): Promise<TGuildConfiguration | false> => {
  const config = await getGuildConfigByGuildId({
    guildId: interaction.guildId!
  })

  if (!config) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error - Not Configured',
          'Guild configuration not found.'
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  const vipChannels = await getActiveVipChannels(interaction.guildId!)

  const allowedChannels = [...(config.casinoChannelIds ?? []), ...vipChannels]

  if (!allowedChannels.length) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error - Not Configured',
          'Casino channels are not configured yet.'
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  if (!allowedChannels.includes(interaction.channelId)) {
    const allowed = allowedChannels.map((id) => `<#${id}>`).join(', ')
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error - Incorrect Channel',
          `This command can only be used in: ${allowed}`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  return config
}

export const checkPredictionChannels = async (
  interaction: ChatInputCommandInteraction
): Promise<TGuildConfiguration | false> => {
  const config = await getGuildConfigByGuildId({
    guildId: interaction.guildId!
  })

  if (
    !config?.predictionChannelIds?.actions ||
    !config.predictionChannelIds.logs
  ) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error - Not Configured',
          'Prediction channels are not configured yet.'
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  if (interaction.channelId !== config.predictionChannelIds.actions) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'Error - Incorrect Channel',
          `This command can only be used in <#${config.predictionChannelIds.actions}>.`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  return config
}
