import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  CommandInteractionOptionResolver,
  EmbedBuilder
} from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import {
  formatNumberToReadableString,
  parseReadableStringToNumber
} from '@/utils/common/utils'

export const data: CommandData = {
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

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
  devOnly: true
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const options = interaction.options as CommandInteractionOptionResolver

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
    console.error('Error running the command:', error)
  }
}
