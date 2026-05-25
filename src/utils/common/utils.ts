import {
  formatNumberToReadableString,
  validateBetAmount
} from 'gambling-bot-shared'
import { DateTime } from 'luxon'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand } from 'commandkit'

import { createInfoEmbed } from '../discord/createEmbed'

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
  minBet: number
): boolean => {
  const result = validateBetAmount(betAmount, maxBet, minBet)

  if (result.ok) return true

  switch (result.error) {
    case 'INVALID_NUMBER':
      interaction.reply({
        embeds: [
          createInfoEmbed('Invalid Input', 'Bet must be a valid number.')
        ],
        flags: MessageFlags.Ephemeral
      })
      return false
    case 'TOO_MANY_DECIMALS':
      interaction.reply({
        embeds: [
          createInfoEmbed(
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
          createInfoEmbed(
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
          createInfoEmbed(
            'Invalid Input - Above Maximum Bet',
            `The maximum bet is **$${formatNumberToReadableString(maxBet)}**.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
      return false
    case 'BELOW_MIN_BET':
      interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Below Minimum Bet',
            `The minimum bet is **$${formatNumberToReadableString(minBet)}**.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
      return false
  }
}
