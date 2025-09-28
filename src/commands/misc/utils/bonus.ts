import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  checkUserRegistration,
  formatNumberToReadableString,
} from '../../../utils/utils'
import {
  MessageFlags,
  EmbedBuilder,
  ApplicationCommandOptionType,
  Colors,
} from 'discord.js'
import { createErrorEmbed, createInfoEmbed } from '../../../utils/createEmbed'
import GuildConfiguration from '../../../models/GuildConfiguration'
import User from '../../../models/User'
import Transaction from '../../../models/Transaction'

export const data: CommandData = {
  name: 'bonus',
  description: 'Daily bonus system with streaks.',
  dm_permission: false,
  options: [
    {
      name: 'claim',
      description: 'Claim your daily bonus',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'check',
      description: 'Check your streak and next bonus',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
}

export const options: CommandOptions = { deleted: false }

export async function run({ interaction }: SlashCommandProps) {
  try {
    const subcommand = interaction.options.getSubcommand()
    const user = await checkUserRegistration(
      interaction.user.id,
      interaction.guildId!
    )
    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed('Error - Not registered', 'Use `/register` first.'),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const guildConfig = await GuildConfiguration.findOne({
      guildId: interaction.guildId!,
    })
    if (!guildConfig || !guildConfig.bonusSettings) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Bonus not configured',
            'Daily bonus is not configured for this server.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const settings = guildConfig.bonusSettings
    const {
      rewardMode = 'linear',
      baseReward = 0,
      streakIncrement = 0,
      streakMultiplier = 1,
      maxReward = 0,
      resetOnMax = false,
      milestoneBonus: {
        weekly: milestoneWeekly = 0,
        monthly: milestoneMonthly = 0,
      } = {},
    } = settings

    const now = new Date()
    const lastClaim = user.lastDailyClaim ? new Date(user.lastDailyClaim) : null
    let streak = user.dailyStreak ?? 0

    const calculateReward = (streakNum: number) => {
      let reward = Number(baseReward)

      if (rewardMode === 'linear') {
        reward += (streakNum - 1) * Number(streakIncrement)
      } else {
        reward *= Math.pow(Number(streakMultiplier), streakNum - 1)
      }

      if (maxReward > 0 && reward > maxReward) {
        if (resetOnMax) {
          if (rewardMode === 'linear') {
            const cycleLength =
              Math.floor((maxReward - baseReward) / streakIncrement) + 1
            const newStreak = ((streakNum - 1) % cycleLength) + 1
            reward = baseReward + (newStreak - 1) * streakIncrement
          } else {
            const cycleLength =
              Math.floor(
                Math.log(maxReward / baseReward) / Math.log(streakMultiplier)
              ) + 1
            const newStreak = ((streakNum - 1) % cycleLength) + 1
            reward = baseReward * Math.pow(streakMultiplier, newStreak - 1)
          }
        } else {
          reward = maxReward
        }
      }

      if (streakNum % 7 === 0) reward += Number(milestoneWeekly)
      if (streakNum % 28 === 0) reward += Number(milestoneMonthly)

      return reward
    }

    if (subcommand === 'check') {
      const nowTime = now.getTime()
      const lastTime = lastClaim ? lastClaim.getTime() : 0

      let currentStreak: number
      let nextStreak: number

      if (!lastClaim) {
        currentStreak = 0
        nextStreak = 1
      } else {
        const diff = nowTime - lastTime
        if (diff < 24 * 60 * 60 * 1000) {
          currentStreak = streak
          nextStreak = streak + 1
        } else if (diff < 48 * 60 * 60 * 1000) {
          currentStreak = streak
          nextStreak = streak + 1
        } else {
          currentStreak = 0
          nextStreak = 1
        }
      }

      const nextReward = calculateReward(nextStreak)

      const totalDays = 28
      let calendar = ''
      for (let i = 1; i <= totalDays; i++) {
        const isWeekly = i % 7 === 0
        const isMonthly = i % 28 === 0
        let emoji = '▫️'

        if (i <= currentStreak) {
          if (isMonthly) emoji = '🏆'
          else if (isWeekly) emoji = '💎'
          else emoji = '✅'
        } else if (i === nextStreak) {
          if (isMonthly) emoji = '🏆'
          else if (isWeekly) emoji = '💎'
          else emoji = '🌟'
        } else {
          if (isMonthly) emoji = '🥇'
          else if (isWeekly) emoji = '🔹'
        }

        calendar += emoji
        if (i % 7 === 0) calendar += '\n'
      }

      let claimInfo = 'Available now!'
      if (lastClaim) {
        const nextClaim = new Date(lastTime + 24 * 60 * 60 * 1000)
        if (now < nextClaim) {
          claimInfo = `**<t:${Math.floor(
            nextClaim.getTime() / 1000
          )}:f> / <t:${Math.floor(nextClaim.getTime() / 1000)}:R>**`
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('Daily Bonus Calendar')
        .setColor(Colors.Blue)
        .setDescription(`Here is your bonus streak calendar:\n\n${calendar}`)
        .addFields(
          {
            name: '🔥 Current Streak',
            value: `${currentStreak} day${currentStreak !== 1 ? 's' : ''}`,
            inline: true,
          },
          {
            name: '💰 Next Reward',
            value: `$${formatNumberToReadableString(nextReward)}`,
            inline: true,
          },
          { name: '⏰ Next Claim', value: claimInfo, inline: false }
        )
        .setTimestamp()

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (subcommand === 'claim') {
      const canClaim =
        !lastClaim || now.getTime() - lastClaim.getTime() >= 24 * 60 * 60 * 1000
      if (!canClaim) {
        const nextClaim = new Date(lastClaim!.getTime() + 24 * 60 * 60 * 1000)
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Daily Bonus Already Claimed',
              `Come back at **<t:${Math.floor(
                nextClaim.getTime() / 1000
              )}:f> / <t:${Math.floor(nextClaim.getTime() / 1000)}:R>**`
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      streak =
        lastClaim && now.getTime() - lastClaim.getTime() < 48 * 60 * 60 * 1000
          ? streak + 1
          : 1
      const reward = calculateReward(streak)

      const updatedUser = await User.findOneAndUpdate(
        {
          userId: user.userId,
          guildId: user.guildId,
          $or: [
            {
              lastDailyClaim: {
                $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
              },
            },
            { lastDailyClaim: null },
          ],
        },
        {
          $inc: { balance: reward, lockedBalance: reward },
          $set: { lastDailyClaim: now, dailyStreak: streak },
        },
        { new: true }
      )

      if (!updatedUser) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Daily Bonus Already Claimed',
              'You already claimed your daily bonus.'
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
      }

      await Transaction.create({
        userId: updatedUser.userId,
        guildId: updatedUser.guildId,
        amount: reward,
        type: 'bonus',
        source: 'system',
        meta: {
          bonusStreak: streak,
        },
        createdAt: now,
      })

      const embed = new EmbedBuilder()
        .setTitle('Daily Bonus Claimed!')
        .setColor(Colors.Gold)
        .setDescription(
          `You claimed your daily bonus and received **$${formatNumberToReadableString(
            reward
          )}** coins!`
        )
        .addFields(
          {
            name: '🔥 Current Streak',
            value: `${streak} day${streak !== 1 ? 's' : ''}`,
            inline: true,
          },
          {
            name: '💰 New Balance',
            value: `$${formatNumberToReadableString(updatedUser.balance)}`,
            inline: true,
          }
        )
        .setFooter({ text: 'Come back tomorrow to keep your streak alive!' })
        .setTimestamp()

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
    }
  } catch (error) {
    console.error('Error running /bonus command:', error)
  }
}
