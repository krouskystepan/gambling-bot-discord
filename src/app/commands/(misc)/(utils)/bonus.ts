import {
  calculateBonusReward,
  canClaimDailyBonus,
  formatNumberToReadableString,
  getStreakAfterClaim,
  getStreakDisplay,
  normalizeBonusSettings
} from 'gambling-bot-shared'

import {
  ApplicationCommandOptionType,
  Colors,
  EmbedBuilder,
  MessageFlags
} from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  checkUserRegistration,
  claimDailyBonus,
  createTransaction,
  getGuildConfigByGuildId
} from '@/services'
import { createErrorEmbed, createInfoEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
  name: 'bonus',
  description: 'Daily bonus system with streaks.',
  dm_permission: false,
  options: [
    {
      name: 'claim',
      description: 'Claim your daily bonus',
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: 'check',
      description: 'Check your streak and next bonus',
      type: ApplicationCommandOptionType.Subcommand
    }
  ]
}

// TODO: fix and test the bonuses
// DO NOT USE LOCKED BALANCE - CHECK IF CAN IDK
export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const subcommand = interaction.options.getSubcommand()
    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    if (!guildConfig || !guildConfig.bonusSettings) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Bonus not configured',
            'Daily bonus is not configured for this server.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const settings = normalizeBonusSettings(guildConfig.bonusSettings)

    const now = new Date()
    const lastClaim = user.lastDailyClaim ? new Date(user.lastDailyClaim) : null
    let streak = user.dailyStreak ?? 0

    if (subcommand === 'check') {
      const { currentStreak, nextStreak } = getStreakDisplay(
        lastClaim,
        now,
        streak
      )

      const nextReward = calculateBonusReward({
        streak: nextStreak,
        settings
      }).reward

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
        const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000)
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
            inline: true
          },
          {
            name: '💰 Next Reward',
            value: `$${formatNumberToReadableString(nextReward)}`,
            inline: true
          },
          { name: '⏰ Next Claim', value: claimInfo, inline: false }
        )
        .setTimestamp()

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      })
    }

    if (subcommand === 'claim') {
      if (!canClaimDailyBonus(lastClaim, now)) {
        const nextClaim = new Date(lastClaim!.getTime() + 24 * 60 * 60 * 1000)
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Daily Bonus Already Claimed',
              `Come back at **<t:${Math.floor(
                nextClaim.getTime() / 1000
              )}:f> / <t:${Math.floor(nextClaim.getTime() / 1000)}:R>**`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      streak = getStreakAfterClaim(lastClaim, now, streak)
      const reward = calculateBonusReward({ streak, settings }).reward

      const updatedUser = await claimDailyBonus({
        user,
        reward,
        streak,
        now
      })

      if (!updatedUser) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Daily Bonus Already Claimed',
              'You already claimed your daily bonus.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId: updatedUser.userId,
        guildId: updatedUser.guildId,
        amount: reward,
        type: 'bonus',
        source: 'system',
        meta: {
          bonusStreak: streak
        }
      })

      logger.event(
        {
          action: 'daily_bonus_claim',
          userId: interaction.user.id,
          amount: reward,
          streak,
          guildId: interaction.guildId
        },
        'User claimed daily bonus'
      )

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
            inline: true
          },
          {
            name: '🎁 Bonus Balance',
            value: `$${formatNumberToReadableString(updatedUser.bonusBalance)}`,
            inline: true
          }
        )
        .setFooter({ text: 'Come back tomorrow to keep your streak alive!' })
        .setTimestamp()

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
