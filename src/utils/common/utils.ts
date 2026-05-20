import { DateTime } from 'luxon'

import { MessageFlags } from 'discord.js'

import { ChatInputCommand } from 'commandkit'

import { validateBetAmount } from '../bets/validateBetAmount'
import { createInfoEmbed } from '../discord/createEmbed'

export const sleep = (ms: number) =>
  new Promise<void>((res) => setTimeout(res, ms))

export const generateId = (): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .padStart(5, '0')
  return `${timestamp}${random}`.toUpperCase()
}

export const formatNumberToReadableString = (number: number): string => {
  const absNumber = Math.abs(number)

  const roundTo = (num: number, digits = 2) =>
    Math.round(num * 10 ** digits) / 10 ** digits

  let formatted: string

  if (absNumber >= 1_000_000_000) {
    formatted = `${roundTo(absNumber / 1_000_000_000)}B`
  } else if (absNumber >= 1_000_000) {
    formatted = `${roundTo(absNumber / 1_000_000)}M`
  } else if (absNumber >= 1_000) {
    formatted = `${roundTo(absNumber / 1_000)}k`
  } else {
    formatted = roundTo(absNumber).toString()
  }

  return number < 0 ? `-${formatted}` : formatted
}

export const parseReadableStringToNumber = (readableString: string): number => {
  const normalizedString = readableString.toUpperCase()

  if (!/^[-]?[0-9.]+[BMK]?$/.test(normalizedString)) {
    return NaN
  }

  if (normalizedString.endsWith('B')) {
    return parseFloat(normalizedString.slice(0, -1)) * 1_000_000_000
  } else if (normalizedString.endsWith('M')) {
    return parseFloat(normalizedString.slice(0, -1)) * 1_000_000
  } else if (normalizedString.endsWith('K')) {
    return parseFloat(normalizedString.slice(0, -1)) * 1_000
  } else {
    return parseFloat(normalizedString)
  }
}

export const formatNumberWithSpaces = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export const formatNumberToPercentage = (num: number): string => {
  return (num * 100).toFixed(2) + '%'
}

export const formatDate = (date: Date) =>
  DateTime.fromJSDate(date, { zone: 'utc' })
    .setZone('Europe/Prague')
    .toFormat('dd.LL.yyyy HH:mm')

export const parseTimeToSeconds = (time: string): number => {
  const regex = /(\d+)([mhdw])/gi
  let totalSeconds = 0

  const sanitizedTime = time.replace(/\s+/g, '')
  const matches = sanitizedTime.match(regex)

  if (!matches) return 0

  matches.forEach((match) => {
    const value = parseInt(match.slice(0, -1), 10)
    const unit = match.slice(-1).toLowerCase()

    switch (unit) {
      case 'm':
        totalSeconds += value * 60
        break
      case 'h':
        totalSeconds += value * 3600
        break
      case 'd':
        totalSeconds += value * 86400
        break
      case 'w':
        totalSeconds += value * 604800
        break
    }
  })

  return totalSeconds
}

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
