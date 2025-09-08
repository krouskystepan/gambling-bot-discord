import type { CommandData, SlashCommandProps, CommandOptions } from 'commandkit'
import {
  checkUserRegistration,
  formatNumberToReadableString,
  parseReadableStringToNumber,
} from '../../../utils/utils'
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
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
  name: 'deposit',
  description: 'Deposit money to your account.',
  options: [
    {
      name: 'amount',
      description: 'The amount you want to deposit (e.g., 1000, 2k, 10.5k).',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'account',
      description: 'The account from which you are sending money.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  dm_permission: false,
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

    const logChannel = client.channels.cache.get(
      guildConfiguration.atmChannelIds.logs
    ) as TextChannel

    const member = interaction.member as GuildMember | null
    const displayName =
      member?.displayName ||
      interaction.user.globalName ||
      interaction.user.username

    const managerRole = guildConfiguration.managerRoleId

    const logMessage = await logChannel.send({
      content: `${managerRole ? `<@&${managerRole}>` : ''}`,
      embeds: [
        new EmbedBuilder()
          .setTitle(
            `ATM - Deposit by ${displayName} (${interaction.user.username})`
          )
          .setColor('Green')
          .setDescription(
            `<@${interaction.user.id}> has deposited **$${readableAmount}** from account **${account}**.`
          ),
      ],
      components: [],
    })

    const approveButton = new ButtonBuilder()
      .setCustomId(
        `atm.approve._.${interaction.user.id}-${logMessage.id}.${parsedAmount}`
      )
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success)

    const rejectButton = new ButtonBuilder()
      .setCustomId(
        `atm.reject._.${interaction.user.id}-${logMessage.id}.${parsedAmount}`
      )
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      approveButton,
      rejectButton
    )

    await logMessage.edit({ components: [row] })

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM - Deposit',
          `You have successfully deposited **$${readableAmount}** to your account.\nPlease wait for the transaction to be processed.`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
  } catch (error) {
    console.error('Error running the command:', error)
  }
}
