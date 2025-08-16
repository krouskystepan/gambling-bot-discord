import mongoose from 'mongoose'
import GuildConfiguration from '../models/GuildConfiguration'
import {
  ChatInputCommandInteraction,
  CacheType,
  MessageFlags,
} from 'discord.js'
import User from '../models/User'
import { createErrorEmbed } from './createEmbed'
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

type ChannelType =
  | 'casinoChannelIds'
  | 'adminChannelIds'
  | 'predictionChannelIds'

export const checkChannelConfiguration = async (
  interaction: ChatInputCommandInteraction<CacheType>,
  channelType: ChannelType,
  messages: {
    notSet: string
    notAllowed: string
  }
) => {
  try {
    let guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (!guildConfiguration) {
      guildConfiguration = new GuildConfiguration({
        guildId: interaction.guildId,
        casinoSettings: defaultCasinoSettings,
      })
      await guildConfiguration.save()
    } else if (!guildConfiguration.casinoSettings) {
      guildConfiguration.casinoSettings = defaultCasinoSettings
      await guildConfiguration.save()
    }

    let allowedChannelIds: string[] = guildConfiguration[channelType] || []

    if (channelType === 'casinoChannelIds') {
      const activeVipRooms = await VipRoom.find({
        guildId: interaction.guildId,
        expiresAt: { $gt: new Date() },
      })
      allowedChannelIds = allowedChannelIds.concat(
        activeVipRooms.map((vip) => vip.channelId)
      )
    }

    if (!allowedChannelIds.length) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error - Not Configured', messages.notSet)],
        flags: MessageFlags.Ephemeral,
      })
      return false
    }

    if (!allowedChannelIds.includes(interaction.channelId)) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Incorrect Channel',
            `${messages.notAllowed} ${allowedChannelIds
              .map((id) => `<#${id}>`)
              .join(', ')}.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return false
    }

    return guildConfiguration
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
  const regex = /(\d+)([dw])/gi
  let totalSeconds = 0

  const sanitizedTime = time.replace(/\s+/g, '')

  const matches = sanitizedTime.match(regex)

  if (!matches) {
    throw new Error(
      'Invalid format. Use a format like "1d", "2d", or "1w". Minimum duration is 1 day.'
    )
  }

  matches.forEach((match) => {
    const value = parseInt(match.slice(0, -1), 10)
    const unit = match.slice(-1).toLowerCase()

    switch (unit) {
      case 'd':
        totalSeconds += value * 86400
        break
      case 'w':
        totalSeconds += value * 604800
        break
      default:
        throw new Error(
          'Invalid unit. Only "d" (days) and "w" (weeks) are allowed.'
        )
    }
  })

  if (totalSeconds < 86400) {
    throw new Error('VIP duration must be at least 1 day.')
  }

  return totalSeconds
}
