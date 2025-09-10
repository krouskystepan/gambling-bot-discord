import mongoose from 'mongoose'
import GuildConfiguration from '../models/GuildConfiguration'
import {
  ChatInputCommandInteraction,
  CacheType,
  MessageFlags,
  EmbedBuilder,
  BaseInteraction,
} from 'discord.js'
import User, { UserDoc } from '../models//User'
import { createErrorEmbed, createInfoEmbed } from './createEmbed'
import defaultCasinoSettings from './defaultConfig'
import VipRoom from '../models/VipRoom'
import Milestone from '../models/Milestone'

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
  | 'transactionChannelId'
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

    let allowedChannelIds: string[] = []

    if (channelType === 'predictionChannelIds') {
      const actionsChannel = guildConfiguration.predictionChannelIds.actions
      const logsChannel = guildConfiguration.predictionChannelIds.logs

      if (!actionsChannel || !logsChannel) {
        await interaction.reply({
          embeds: [createErrorEmbed('Error - Not Configured', messages.notSet)],
          flags: MessageFlags.Ephemeral,
        })
        return false
      }

      allowedChannelIds = [actionsChannel]
    } else if (channelType === 'transactionChannelId') {
      allowedChannelIds = guildConfiguration.transactionChannelId
        ? [guildConfiguration.transactionChannelId]
        : []
    } else {
      allowedChannelIds = guildConfiguration[channelType] || []
    }

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

export async function checkMilestones(
  interaction: BaseInteraction,
  user: UserDoc,
  guildId: string
) {
  const guildConf = await GuildConfiguration.findOne({ guildId })
  if (!guildConf) return

  const guildMilestonesDoc = await Milestone.findOne({ guildId })
  if (!guildMilestonesDoc) return

  const { baseThreshold, baseReward, multiplierThreshold, multiplierReward } =
    guildMilestonesDoc

  const milestones: { threshold: number; reward: number }[] = []
  let threshold = baseThreshold
  let reward = baseReward
  while (threshold <= 1_000_000_000) {
    milestones.push({ threshold, reward })
    threshold = Math.floor(threshold * multiplierThreshold)
    reward = Math.floor(reward * multiplierReward)
  }

  let lastUnlocked = user.milestoneUnlocked ?? 0
  const unlocked: { threshold: number; reward: number }[] = []

  for (const m of milestones) {
    if (m.threshold > lastUnlocked) {
      const progress = user.amountGambled - lastUnlocked
      if (progress >= m.threshold - lastUnlocked) {
        unlocked.push(m)
        lastUnlocked = m.threshold
      }
      break
    }
  }

  if (unlocked.length) {
    const totalReward = unlocked.reduce((sum, m) => sum + m.reward, 0)
    user.milestoneUnlocked = lastUnlocked
    user.balance += totalReward
    await user.save()

    const milestoneMessages = unlocked
      .map(
        (m) =>
          `🎉 Unlocked milestone **${formatNumberToReadableString(
            m.threshold
          )}** → +**$${formatNumberToReadableString(m.reward)}**`
      )
      .join('\n')

    if (
      interaction.isChatInputCommand() ||
      interaction.isButton() ||
      interaction.isStringSelectMenu() ||
      interaction.isUserSelectMenu() ||
      interaction.isRoleSelectMenu() ||
      interaction.isMentionableSelectMenu() ||
      interaction.isChannelSelectMenu()
    ) {
      await interaction.followUp({
        content: `💎 You unlocked new milestones!\n${milestoneMessages}`,
        flags: MessageFlags.Ephemeral,
      })
    }

    // Transaction channel
    if (guildConf.transactionChannelId) {
      const channel = interaction.guild?.channels.cache.get(
        guildConf.transactionChannelId
      )
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle('ATM - Milestone Unlocked!')
          .setColor('Orange')
          .setDescription(
            `User <@${user.userId}> just unlocked the following milestone(s):`
          )
          .addFields(
            unlocked.map((m) => ({
              name: `Threshold: ${formatNumberToReadableString(m.threshold)}`,
              value: `Reward: 💰 ${formatNumberToReadableString(m.reward)}`,
              inline: true,
            }))
          )
          .setTimestamp()

        await channel.send({ embeds: [embed] }).catch(console.error)
      }
    }
  } else {
    await user.save()
  }
}
