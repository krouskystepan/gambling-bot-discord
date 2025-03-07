import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  checkUserRegistration,
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from '../../../utils/utils'
import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  TextChannel,
} from 'discord.js'
import GuildConfiguration from '../../../models/GuildConfiguration'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'

export const data: CommandData = {
  name: 'withdraw',
  description: 'Withdraw money from your account.',
  options: [
    {
      name: 'amount',
      description: 'The amount you want to withdraw (e.g., 1000, 2k, 10.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'account',
      description: 'The account you want to send the money to.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  contexts: [0],
}

export const options: CommandOptions = {
  deleted: false,
}

export async function run({ interaction, client }: SlashCommandProps) {
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

    const guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (!guildConfiguration?.atmChannelIds.logs) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Logs Not Set Up',
            'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (!guildConfiguration?.atmChannelIds.actions) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Actions Not Configured',
            'This ATM command has not been set up yet.\nPlease contact an administrator to complete the setup.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (guildConfiguration?.atmChannelIds.actions !== interaction.channelId) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Incorrect Channel',
            `This command can only be used in <#${guildConfiguration.atmChannelIds.actions}>.\nPlease use the correct channel to proceed.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    const account = interaction.options.getString('account', true)

    const amount = interaction.options.getString('amount', true)
    const parsedAmount = parseReadableStringToNumber(amount)
    const readableAmount = formatNumberToReadableString(parsedAmount)

    if (isNaN(parsedAmount)) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Not a number',
            'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (parsedAmount <= 0) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Invalid Input - Non-positive number',
            'The number you provided must be greater than 0.\nPlease enter a positive value.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    if (user.balance < parsedAmount) {
      return interaction.reply({
        embeds: [
          createInfoEmbed(
            'Insufficient Funds',
            `You don't have enough funds to withdraw **$${readableAmount}**.\nYour current balance is **$${formatNumberToReadableString(
              user.balance
            )}**.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

    user.balance -= parsedAmount

    await user.save()

    const logChannel = client.channels.cache.get(
      guildConfiguration.atmChannelIds.logs
    ) as TextChannel

    const member = interaction.member as GuildMember | null
    const displayName =
      member?.displayName ||
      interaction.user.globalName ||
      interaction.user.username

    logChannel
      .send({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              `Withdrawal by ${displayName} (${interaction.user.username})`
            )
            .setColor('Red')
            .setDescription(
              `<@${interaction.user.id}> has withdrawn **$${readableAmount}** into account **${account}**.`
            ),
        ],
      })
      .then((message) => {
        message.react('✅')
      })
      .catch(console.error)

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM - Withdraw',
          `You have successfully withdrawn **$${readableAmount}**.\nPlease wait for the transaction to be processed.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
