import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  Message,
  MessageFlags
} from 'discord.js'

import { CommandData, CommandOptions, SlashCommandProps } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  attachAtmRequestMessage,
  checkAtmChannels,
  checkUserRegistration,
  createAtmRequest,
  deleteAtmRequest
} from '@/services'
import {
  formatNumberToReadableString,
  generateId,
  parseReadableStringToNumber
} from '@/utils/common/utils'
import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

export const data: CommandData = {
  name: 'deposit',
  description: 'Deposit money to your account.',
  options: [
    {
      name: 'amount',
      description: 'The amount you want to deposit (e.g., 1000, 2k, 10.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'account',
      description: 'The account from which you are sending money.',
      type: ApplicationCommandOptionType.String,
      required: true
    }
  ],
  dm_permission: false
}

export const options: CommandOptions = {
  deleted: false
}

export async function run({ interaction }: SlashCommandProps) {
  try {
    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const guildConfiguration = await checkAtmChannels(interaction)
    if (!guildConfiguration) return

    const account = interaction.options.getString('account', true)
    const amount = interaction.options.getString('amount', true)
    const parsedAmount = parseReadableStringToNumber(amount)
    const readableAmount = formatNumberToReadableString(parsedAmount)

    if (isNaN(parsedAmount)) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Input - Not a number',
            'The value you entered is not a valid number.\nPlease make sure you enter a numerical value.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (parsedAmount <= 0) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Invalid Input - Non-positive number',
            'The number you provided must be greater than 0.\nPlease enter a positive value.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const logChannel = await interaction
      .guild!.channels.fetch(guildConfiguration.atmChannelIds.logs)
      .catch(() => null)

    if (!isGuildSendableChannel(logChannel)) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Wrong Discord Configuration',
            'Log channel misconfigured or inaccessible.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const member = interaction.member as GuildMember | null
    const displayName =
      member?.displayName ||
      interaction.user.globalName ||
      interaction.user.username

    const managerRole = guildConfiguration.managerRoleId

    const requestId = generateId()

    await createAtmRequest({
      requestId,
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      type: 'deposit',
      amount: parsedAmount,
      account
    })

    let logMessage: Message<true>

    try {
      logMessage = await logChannel.send({
        content: `${managerRole ? `<@&${managerRole}>` : ''}`,
        embeds: [
          new EmbedBuilder()
            .setTitle(
              `ATM - Deposit by ${displayName} (${interaction.user.username})`
            )
            .setColor('Green')
            .setDescription(
              `<@${interaction.user.id}> requested a deposit of **$${readableAmount}** from account **${account}**.`
            )
        ]
      })
    } catch (err) {
      await deleteAtmRequest(requestId)
      throw err
    }

    await attachAtmRequestMessage(requestId, logChannel.id, logMessage.id)

    const approveButton = new ButtonBuilder()
      .setCustomId(`atm.approve.${requestId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success)

    const rejectButton = new ButtonBuilder()
      .setCustomId(`atm.reject.${requestId}`)
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
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
