import {
  calculateBonusReward,
  canClaimDailyBonus,
  formatMoney,
  getBonusCycleLength,
  getEffectiveStreak,
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
  assertGlobalFeature,
  assertNotMaintenance,
  checkUserRegistration,
  claimDailyBonusAtomic,
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

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const subcommand = interaction.options.getSubcommand()
    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    if (!guildConfig) {
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
    if (!(await assertNotMaintenance(interaction, guildConfig))) return
    if (!(await assertGlobalFeature(interaction, guildConfig, 'dailyBonus'))) {
      return
    }
    if (!guildConfig.bonusSettings) {
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
    const storedStreak = user.dailyStreak ?? 0

    if (subcommand === 'check') {
      const { currentStreak, nextStreak } = getStreakDisplay(
        lastClaim,
        now,
        getEffectiveStreak(lastClaim, now, storedStreak)
      )

      const nextReward = calculateBonusReward({
        streak: nextStreak,
        settings
      }).reward

      const cycleLength = settings.resetOnMax
        ? Math.min(
            28,
            getBonusCycleLength(
              settings.rewardMode,
              settings.baseReward,
              settings.maxReward,
              settings.streakIncrement ?? 0,
              settings.streakMultiplier ?? 1
            )
          )
        : 28
      const totalDays = Math.max(cycleLength, 7)

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
        .setDescription(
          `Here is your bonus streak calendar (${totalDays} day cycle):\n\n${calendar}`
        )
        .addFields(
          {
            name: '🔥 Current Streak',
            value: `${currentStreak} day${currentStreak !== 1 ? 's' : ''}`,
            inline: true
          },
          {
            name: '💰 Next Reward',
            value: `${formatMoney(nextReward, guildConfig.globalSettings)}`,
            inline: true
          },
          { name: '⏰ Next Claim', value: claimInfo, inline: false }
        )
        .setFooter({
          text: 'Daily bonus credits bonus balance only — never locked balance.'
        })
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

      const claimResult = await claimDailyBonusAtomic({
        userId: user.userId,
        guildId: user.guildId,
        now,
        settings
      })

      if (!claimResult.ok) {
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

      const { user: updatedUser, reward, streak, isReset } = claimResult

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

      const resetNote = isReset
        ? '\n\nYour reward cycle has reset — keep the streak going!'
        : ''

      const embed = new EmbedBuilder()
        .setTitle('Daily Bonus Claimed!')
        .setColor(Colors.Gold)
        .setDescription(
          `You claimed your daily bonus and received **${formatMoney(
            reward,
            guildConfig.globalSettings
          )}** coins!${resetNote}`
        )
        .addFields(
          {
            name: '🔥 Current Streak',
            value: `${streak} day${streak !== 1 ? 's' : ''}`,
            inline: true
          },
          {
            name: '🎁 Bonus Balance',
            value: `${formatMoney(updatedUser.bonusBalance, guildConfig.globalSettings)}`,
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
