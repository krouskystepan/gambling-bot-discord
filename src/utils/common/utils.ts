import {
  CacheType,
  ChatInputCommandInteraction,
  MessageFlags
} from 'discord.js'

import { createInfoEmbed } from '../discord/createEmbed'

export const generateBetId = (): string => {
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
  interaction: ChatInputCommandInteraction<CacheType>,
  betAmount: number,
  maxBet: number,
  minBet: number,
  userBalance: number,
  xTimes?: number
): boolean => {
  if (!Number.isFinite(betAmount)) {
    interaction.reply({
      embeds: [createInfoEmbed('Invalid Input', 'Bet must be a valid number.')],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  const betCentsRaw = betAmount * 100
  const betCents = Math.round(betCentsRaw)

  if (Math.abs(betCentsRaw - betCents) > 1e-6) {
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
  }

  const balanceCents = Math.floor(userBalance * 100)
  const minBetCents = Math.floor(minBet * 100)
  const maxBetCents = Math.floor(maxBet * 100)

  if (betAmount < 1) {
    interaction.reply({
      embeds: [
        createInfoEmbed('Invalid Bet Amount', `Minimum possible bet is **$1**.`)
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  if (maxBetCents > 0 && betCents > maxBetCents) {
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
  }

  if (minBetCents > 0 && betCents < minBetCents) {
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

  if (balanceCents < betCents) {
    interaction.reply({
      embeds: [
        createInfoEmbed(
          'Insufficient Funds',
          `You don't have enough money to place this bet.\nYour current balance is **$${formatNumberToReadableString(
            userBalance
          )}**.`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
    return false
  }

  if (typeof xTimes === 'number' && xTimes > 0) {
    const totalBetCents = betCents * xTimes

    if (balanceCents < totalBetCents) {
      interaction.reply({
        embeds: [
          createInfoEmbed(
            'Insufficient Funds',
            `You don't have enough money to place this bet for ${xTimes} spins (you need **$${formatNumberToReadableString(
              totalBetCents / 100
            )}**).\nYour current balance is **$${formatNumberToReadableString(userBalance)}**.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
      return false
    }
  }

  return true
}
