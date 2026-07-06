import { validateBetAmount } from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import { type GlobalSettings } from 'gambling-bot-shared/guild'
import { DateTime } from 'luxon'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand } from 'commandkit'

import { createErrorEmbed } from '../discord/createEmbed'

export const sleep = (ms: number) =>
  new Promise<void>((res) => setTimeout(res, ms))

export const formatDate = (date: Date) =>
  DateTime.fromJSDate(date, { zone: 'utc' })
    .setZone('Europe/Prague')
    .toFormat('dd.LL.yyyy HH:mm')

export const checkValidBet = (
  interaction: Parameters<ChatInputCommand>[0]['interaction'],
  betAmount: number,
  maxBet: number,
  minBet: number,
  globalSettings?: Partial<GlobalSettings> | null
): boolean => {
  const result = validateBetAmount(betAmount, maxBet, minBet)

  if (result.ok) return true

  switch (result.error) {
    case 'INVALID_NUMBER':
      interaction.reply({
        embeds: [
          createErrorEmbed('Invalid Input', 'Bet must be a valid number.')
        ],
        flags: MessageFlags.Ephemeral
      })
      return false
    case 'TOO_MANY_DECIMALS':
      interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Bet Amount',
            'Bet must have at most 2 decimal places.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
      return false
    case 'BELOW_MINIMUM':
      interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Bet Amount',
            `Minimum possible bet is **$1**.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
      return false
    case 'ABOVE_MAXIMUM':
      interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Input - Above Maximum Bet',
            `The maximum bet is **${formatMoney(maxBet, globalSettings)}**.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
      return false
    case 'BELOW_MIN_BET':
      interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Input - Below Minimum Bet',
            `The minimum bet is **${formatMoney(minBet, globalSettings)}**.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
      return false
  }
}
