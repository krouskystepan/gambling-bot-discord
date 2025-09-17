import mongoose from 'mongoose'
import GuildConfiguration, {
  GuildConfigurationDoc,
} from '../models/GuildConfiguration'
import {
  ChatInputCommandInteraction,
  CacheType,
  MessageFlags,
} from 'discord.js'
import User from '../models//User'
import { createErrorEmbed, createInfoEmbed } from './createEmbed'
import defaultCasinoSettings from './defaultConfig'
import VipRoom from '../models/VipRoom'

export const connectToDatabase = async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not defined')
    mongoose.set('strictQuery', false)
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to the database')
  } catch (error) {
    console.error('Error connecting to the database:', error)
  }
}

export const generateBetId = (): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .padStart(5, '0')
  return `${timestamp}${random}`.toUpperCase()
}

type ChannelType = 'casinoChannelIds' | 'predictionChannelIds' | 'atmChannelIds'

export const checkChannelConfiguration = async (
  interaction: ChatInputCommandInteraction<CacheType>,
  channelType: ChannelType,
  messages: {
    notSet: string
    notAllowed: string
  }
): Promise<GuildConfigurationDoc | false> => {
  try {
    let guildConfig = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (!guildConfig) {
      guildConfig = new GuildConfiguration({
        guildId: interaction.guildId,
        casinoSettings: defaultCasinoSettings,
      })
      await guildConfig.save()
    } else if (!guildConfig.casinoSettings) {
      guildConfig.casinoSettings = defaultCasinoSettings
      await guildConfig.save()
    }

    let allowedChannelIds: string[] = []

    if (channelType === 'predictionChannelIds') {
      const { actions, logs } = guildConfig.predictionChannelIds || {}
      if (!actions || !logs) {
        await interaction.reply({
          embeds: [createErrorEmbed('Error - Not Configured', messages.notSet)],
          flags: MessageFlags.Ephemeral,
        })
        return false
      }
      allowedChannelIds = [actions]
    } else if (channelType === 'atmChannelIds') {
      const logsChannel = guildConfig.atmChannelIds?.logs
      if (!logsChannel) {
        await interaction.reply({
          embeds: [createErrorEmbed('Error - Not Configured', messages.notSet)],
          flags: MessageFlags.Ephemeral,
        })
        return false
      }
      allowedChannelIds = [logsChannel]
    } else {
      allowedChannelIds = guildConfig[channelType] || []

      if (channelType === 'casinoChannelIds') {
        const activeVipRooms = await VipRoom.find({
          guildId: interaction.guildId,
          expiresAt: { $gt: new Date() },
        })
        allowedChannelIds.push(...activeVipRooms.map((vip) => vip.channelId))
      }
    }

    if (!allowedChannelIds.length) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error - Not Configured', messages.notSet)],
        flags: MessageFlags.Ephemeral,
      })
      return false
    }

    if (!allowedChannelIds.includes(interaction.channelId)) {
      const allowedMentions = allowedChannelIds
        .map((id) => `<#${id}>`)
        .join(', ')
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Incorrect Channel',
            `${messages.notAllowed} ${allowedMentions}.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return false
    }

    return guildConfig
  } catch (error) {
    console.error('Error checking channel configuration:', error)
    return false
  }
}

export const checkUserRegistration = async (
  userId: string,
  guildId: string
) => {
  return await User.findOne({ userId, guildId })
}

export const formatNumberToReadableString = (number: number): string => {
  const absNumber = Math.abs(number)

  let formatted: string
  if (absNumber >= 1_000_000_000) {
    formatted =
      (absNumber / 1_000_000_000).toFixed(
        absNumber % 1_000_000_000 === 0 ? 0 : 2
      ) + 'B'
  } else if (absNumber >= 1_000_000) {
    formatted =
      (absNumber / 1_000_000).toFixed(absNumber % 1_000_000 === 0 ? 0 : 2) + 'M'
  } else if (absNumber >= 1_000) {
    formatted =
      (absNumber / 1_000).toFixed(absNumber % 1_000 === 0 ? 0 : 2) + 'k'
  } else {
    formatted = absNumber.toString()
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
  const regex = /(\d+)([hdw])/gi
  let totalSeconds = 0

  const sanitizedTime = time.replace(/\s+/g, '')

  const matches = sanitizedTime.match(regex)

  if (matches) {
    matches.forEach((match) => {
      const value = parseInt(match.slice(0, -1), 10)
      const unit = match.slice(-1).toLowerCase()

      switch (unit) {
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
  }

  return totalSeconds
}

export const checkValidBet = (
  interaction: ChatInputCommandInteraction<CacheType>,
  betAmount: number,
  maxBet: number,
  minBet: number,
  userBalance: number,
  xTimes?: number
) => {
  if (isNaN(betAmount)) {
    interaction.reply({
      embeds: [
        createInfoEmbed(
          'Invalid Input - Not a number',
          'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
    return false
  }

  if (betAmount <= 0) {
    interaction.reply({
      embeds: [
        createInfoEmbed(
          'Invalid Input - Non-positive number',
          'The number you provided must be greater than 0.\nPlease enter a positive value.'
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
    return false
  }

  if (maxBet > 0 && betAmount > maxBet) {
    interaction.reply({
      embeds: [
        createInfoEmbed(
          'Invalid Input - Above Maximum Bet',
          `The maximum bet is **$${formatNumberToReadableString(maxBet)}**.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
    return false
  }

  if (minBet > 0 && betAmount < minBet) {
    interaction.reply({
      embeds: [
        createInfoEmbed(
          'Invalid Input - Below Minimum Bet',
          `The minimum bet is **$${formatNumberToReadableString(minBet)}**.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
    return false
  }

  if (userBalance < betAmount) {
    interaction.reply({
      embeds: [
        createInfoEmbed(
          'Insufficient Funds',
          `You don't have enough money to place this bet.\nYour current balance is **$${formatNumberToReadableString(
            userBalance
          )}**.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
    return false
  }

  if (xTimes) {
    const totalBet = xTimes * betAmount

    if (userBalance < totalBet) {
      interaction.reply({
        embeds: [
          createInfoEmbed(
            'Insufficient Funds',
            `You don't have enough money to place this bet for ${xTimes} spins (you need **$${formatNumberToReadableString(
              totalBet
            )}**).\nYour current balance is **$${formatNumberToReadableString(
              userBalance
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return false
    }
  }

  return true
}
