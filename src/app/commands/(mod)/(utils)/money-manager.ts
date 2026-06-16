import {
  formatMoney,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder
} from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertModMaintenanceAllowed,
  getGuildConfigByGuildId
} from '@/services'
import { DEV_GUILDS } from '@/utils/devGuilds'
import { logger } from '@/utils/logger'

export const command: CommandData = {
  name: 'money-manager',
  description: 'Create an embed for manage balance.',
  options: [
    {
      name: 'give-balance',
      description: 'Create an embed for giving money.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'amount',
          description: 'The amount of money you want to give.',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'reset-balance',
      description: 'Create an embed for resetting money.',
      type: ApplicationCommandOptionType.Subcommand
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  guilds: DEV_GUILDS
}

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    if (
      (await assertModMaintenanceAllowed(interaction, interaction.guildId!)) ===
      false
    ) {
      return
    }

    const options = interaction.options

    const subcommand = options.getSubcommand()

    if (subcommand === 'give-balance') {
      const amount = interaction.options.getString('amount', true)
      const parsedAmount = parseReadableStringToNumber(amount)
      const embed = new EmbedBuilder()
        .setTitle('Money Generator')
        .setColor(Colors.DarkGreen)
        .setDescription(
          `Click to add **${formatMoney(parsedAmount, guildConfig?.globalSettings)}** to your account.\n` +
            'You can use this money to try **CASINO** games.'
        )
        .setTimestamp()

      const giveButton = new ButtonBuilder()
        .setLabel(`💸 Claim Money`)
        .setStyle(ButtonStyle.Success)
        .setCustomId(`give-money.${parsedAmount}`)

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        giveButton
      )

      logger.event(
        {
          action: 'money_manager_give_embed',
          actorId: interaction.user.id,
          amount: parsedAmount,
          guildId: interaction.guildId
        },
        'Admin posted money generator embed'
      )

      return interaction.reply({
        embeds: [embed],
        components: [row]
      })
    }

    if (subcommand === 'reset-balance') {
      const embed = new EmbedBuilder()
        .setTitle('Money Reset')
        .setColor(Colors.DarkRed)
        .setDescription('Click to reset your account balance.')
        .setTimestamp()

      const resetButton = new ButtonBuilder()
        .setLabel(`🔄 Reset Money`)
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`reset-money`)

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        resetButton
      )

      logger.event(
        {
          action: 'money_manager_reset_embed',
          actorId: interaction.user.id,
          guildId: interaction.guildId
        },
        'Admin posted money reset embed'
      )

      return interaction.reply({
        embeds: [embed],
        components: [row]
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
