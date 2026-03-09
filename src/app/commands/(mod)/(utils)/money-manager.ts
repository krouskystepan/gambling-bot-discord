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
  formatNumberToReadableString,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import { DEV_GUILDS } from '@/utils/devGuilds'

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

export const chatInput: ChatInputCommand = async (ctx) => {
  const { interaction } = ctx

  try {
    const options = interaction.options

    const subcommand = options.getSubcommand()

    if (subcommand === 'give-balance') {
      const amount = interaction.options.getString('amount', true)
      const parsedAmount = parseReadableStringToNumber(amount)
      const readableAmount = formatNumberToReadableString(parsedAmount)

      const embed = new EmbedBuilder()
        .setTitle('Money Generator')
        .setColor(Colors.DarkGreen)
        .setDescription(
          `Click to add **$${readableAmount}** to your account.\n` +
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

      return interaction.reply({
        embeds: [embed],
        components: [row]
      })
    }
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
