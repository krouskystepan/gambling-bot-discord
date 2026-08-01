import { formatMoney } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'

import { Interaction, MessageFlags } from 'discord.js'

import { createErrorEmbed } from '@/utils/discord/createEmbed'

type MoneySettings = Partial<GlobalSettings> | null | undefined

/** Ephemeral error after an interaction may already be deferred. */
export const replyEphemeralError = async (
  interaction: Interaction,
  embeds: ReturnType<typeof createErrorEmbed>[]
) => {
  if (!interaction.isRepliable()) return

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ embeds, flags: MessageFlags.Ephemeral })
    return
  }

  await interaction.reply({ embeds, flags: MessageFlags.Ephemeral })
}

/** Ephemeral bet validation feedback for component / modal driven sessions. */
export const replyBetValidationError = async (
  interaction: Interaction,
  error: string,
  maxBet: number,
  minBet: number,
  globalSettings: MoneySettings
) => {
  const embeds = (() => {
    switch (error) {
      case 'INVALID_NUMBER':
        return [
          createErrorEmbed(
            'Error - Invalid Input',
            'Bet must be a valid number.'
          )
        ]
      case 'TOO_MANY_DECIMALS':
        return [
          createErrorEmbed(
            'Error - Invalid Bet Amount',
            'Bet must have at most 2 decimal places.'
          )
        ]
      case 'BELOW_MINIMUM':
        return [
          createErrorEmbed(
            'Error - Invalid Bet Amount',
            'Minimum possible bet is **$1**.'
          )
        ]
      case 'ABOVE_MAXIMUM':
        return [
          createErrorEmbed(
            'Error - Invalid Bet Amount',
            `Maximum bet is **${formatMoney(maxBet, globalSettings)}**.`
          )
        ]
      case 'BELOW_MIN_BET':
        return [
          createErrorEmbed(
            'Error - Invalid Bet Amount',
            `Minimum bet is **${formatMoney(minBet, globalSettings)}**.`
          )
        ]
      default:
        return [
          createErrorEmbed(
            'Error - Invalid Bet Amount',
            'Bet amount is invalid.'
          )
        ]
    }
  })()

  await replyEphemeralError(interaction, embeds)
}
