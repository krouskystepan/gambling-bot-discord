import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
} from 'discord.js'
import User from '../../models/User'
import { parseReadableStringToNumber } from '../../utils/utils'

export const data: CommandData = {
  name: 'give-balance',
  description: 'Create an embed for giving money.',
  options: [
    {
      name: 'amount',
      description: 'The amount of money you want to give.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  contexts: [0],
}

export const options: CommandOptions = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  deleted: false,
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const amount = interaction.options.getString('amount', true)
    const parsedAmount = parseReadableStringToNumber(amount)

    User.findOne({ userId: interaction.user.id, guildId: interaction.guildId })

    const embed = new EmbedBuilder()
      .setTitle('Money Generator')
      .setColor(Colors.Yellow)
      .setDescription(
        `Click to add **$${amount}** to your account.\n` +
          'You can use this money to try **CASINO** games.'
      )
      .setTimestamp()

    const betButtons = new ButtonBuilder()
      .setLabel(`💸 Claim Money`)
      .setStyle(ButtonStyle.Success)
      .setCustomId(`give-money.${parsedAmount}`)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(betButtons)

    return interaction.reply({
      embeds: [embed],
      components: [row],
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
