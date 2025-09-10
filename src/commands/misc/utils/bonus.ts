import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import { MessageFlags, EmbedBuilder } from 'discord.js'
import {
  checkUserRegistration,
  formatNumberToReadableString,
} from '../../../utils/utils'
import Milestone from '../../../models/Milestone'
import { createErrorEmbed } from '../../../utils/createEmbed'

export const data: CommandData = {
  name: 'bonus',
  description: 'Check your next milestone bonus and progress.',
  dm_permission: false,
}

export const options: CommandOptions = {
  deleted: false,
  devOnly: true,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const user = await checkUserRegistration(
      interaction.user.id,
      interaction.guildId!
    )

    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not registered',
            'You are not registered yet.\nUse the `/register` command to register.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const guildMilestones = await Milestone.findOne({
      guildId: interaction.guildId!,
    })

    if (!guildMilestones) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - No milestones configured',
            'This server has no milestones set up yet.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const { baseThreshold, baseReward, multiplierThreshold, multiplierReward } =
      guildMilestones

    const milestones: { threshold: number; reward: number; index: number }[] =
      []
    let threshold = baseThreshold
    let reward = baseReward
    let index = 1
    while (threshold <= 1_000_000_000) {
      milestones.push({ threshold, reward, index })
      threshold = Math.floor(threshold * multiplierThreshold)
      reward = Math.floor(reward * multiplierReward)
      index++
    }

    const lastUnlocked = user.milestoneUnlocked ?? 0
    const nextMilestone = milestones.find((m) => m.threshold > lastUnlocked)

    const embed = new EmbedBuilder()
      .setTitle('Next Milestone Bonus')
      .setColor('Yellow')

    if (nextMilestone) {
      const amountToNext = nextMilestone.threshold - 0
      // const amountToNext = nextMilestone.threshold - user.amountGambled
      const progress = Math.min(
        ((nextMilestone.threshold - amountToNext) / nextMilestone.threshold) *
          100,
        100
      )

      embed
        .setTitle(`🎯 Milestone #${nextMilestone.index}`)
        .setColor('Gold')
        .setDescription('Here is your progress towards the next milestone:')
        .addFields(
          {
            name: '💰 Reward',
            value: `$${formatNumberToReadableString(nextMilestone.reward)}`,
          },
          {
            name: '📈 Progress',
            value: `${progress.toFixed(2)}%`,
          },
          {
            name: '⬆️ Amount Needed',
            value: `$${formatNumberToReadableString(amountToNext)}`,
          }
        )
        .setFooter({ text: 'Keep playing to unlock more bonuses!' })
        .setTimestamp()
    } else {
      embed
        .setTitle('🏆 All Milestones Unlocked!')
        .setColor('Green')
        .setDescription(
          'You’ve reached the final milestone. Congratulations! 🎉'
        )
    }

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
  } catch (error) {
    console.error('Error running /bonus command:', error)
  }
}
