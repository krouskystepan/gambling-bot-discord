import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  MessageFlags,
  EmbedBuilder,
  ApplicationCommandOptionType,
  Colors,
} from 'discord.js'
import {
  checkUserRegistration,
  formatNumberToReadableString,
} from '../../../utils/utils'
import { createErrorEmbed, createInfoEmbed } from '../../../utils/createEmbed'
import GuildConfiguration from '../../../models/GuildConfiguration'
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

export const options: CommandOptions = {
  deleted: false,
}

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
    if (!guildConfig || guildConfig.bonusSettings.baseReward === 0) {
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

    const { baseReward, streakMultiplier, maxReward, resetOnMax } =
      guildConfig.bonusSettings
    const now = new Date()
    const lastClaim = user.lastDailyClaim ? new Date(user.lastDailyClaim) : null
    let streak = user.dailyStreak ?? 0

    const calculateReward = (streakNum: number) => {
      let reward = baseReward

      for (let i = 1; i < streakNum; i++) {
        reward = Number((reward * streakMultiplier).toFixed(2))
        if (maxReward > 0 && reward > maxReward) {
          reward = resetOnMax ? baseReward : maxReward
          if (resetOnMax) break
        }
      }

      return reward
    }

    if (subcommand === 'check') {
      let nextStreak: number

      if (!lastClaim) {
        nextStreak = 1
      } else {
        const diffHours =
          (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60)

        if (diffHours < 24) {
          nextStreak = streak + 1
        } else if (diffHours >= 24 && diffHours < 48) {
          nextStreak = streak + 1
        } else {
          nextStreak = 1
        }
      }

      const calculateReward = (streakNum: number) => {
        let reward = baseReward
        for (let i = 1; i < streakNum; i++) {
          reward = Number((reward * streakMultiplier).toFixed(2))
          if (maxReward > 0 && reward > maxReward) {
            reward = resetOnMax ? baseReward : maxReward
            if (resetOnMax) break
          }
        }
        return reward
      }

      const nextReward = calculateReward(nextStreak)

      // přidáme výpočet, kdy může claimnout znovu
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
        .setTitle('Daily Bonus Info')
        .setColor(Colors.Blue)
        .setDescription('Here is your bonus info and streak progress:')
        .addFields(
          { name: '🔥 Current Streak', value: `${streak} days`, inline: true },
          {
            name: '💰 Next Reward',
            value: `$${formatNumberToReadableString(nextReward)}`,
            inline: true,
          },
          { name: '⏰ Next Claim', value: claimInfo, inline: false }
        )
        .setFooter({ text: 'Use `/bonus claim` to claim your bonus!' })
        .setTimestamp()

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (subcommand === 'claim') {
      let canClaim = false

      if (!lastClaim) {
        canClaim = true
        streak = 1
      } else {
        const diffHours =
          (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60)
        if (diffHours >= 24 && diffHours < 48) {
          canClaim = true
          streak++
        } else if (diffHours >= 48) {
          canClaim = true
          streak = 1
        }
      }

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

      let reward = calculateReward(streak)
      if (maxReward > 0 && reward >= maxReward && resetOnMax) streak = 1

      user.balance += reward
      await Transaction.create({
        userId: user.userId,
        guildId: user.guildId,
        amount: reward,
        type: 'bonus',
        source: 'system',
        createdAt: new Date(),
      })

      user.dailyStreak = streak
      user.lastDailyClaim = now
      await user.save()

      const embed = new EmbedBuilder()
        .setTitle('Daily Bonus Claimed!')
        .setColor(Colors.Gold)
        .setDescription(
          `You claimed your daily bonus and received **$${formatNumberToReadableString(
            reward
          )}** coins!`
        )
        .addFields(
          { name: '🔥 Current Streak', value: `${streak} days`, inline: true },
          {
            name: '💰 New Balance',
            value: `$${formatNumberToReadableString(user.balance)}`,
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
