import {
  formatMoney,
  generateId,
  parseReadableStringToNumber
} from 'gambling-bot-shared'

import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  GuildTextBasedChannel,
  Message,
  MessageFlags
} from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertGlobalFeature,
  attachAtmRequestMessage,
  checkAtmChannels,
  checkUserRegistration,
  createAtmRequest,
  deleteAtmRequest
} from '@/services'
import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
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

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const user = await checkUserRegistration({ interaction })
    if (!user) return

    const guildConfiguration = await checkAtmChannels(interaction)
    if (!guildConfiguration) return
    if (
      !(await assertGlobalFeature(interaction, guildConfiguration, 'deposit'))
    ) {
      return
    }

    const account = interaction.options.getString('account', true)
    const amount = interaction.options.getString('amount', true)
    const parsedAmount = parseReadableStringToNumber(amount)

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

    const sendableLogChannel = logChannel as GuildTextBasedChannel

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
      logMessage = await sendableLogChannel.send({
        content: `${managerRole ? `<@&${managerRole}>` : ''}`,
        embeds: [
          new EmbedBuilder()
            .setTitle(
              `ATM - Deposit by ${displayName} (${interaction.user.username})`
            )
            .setColor('Green')
            .setDescription(
              `<@${interaction.user.id}> requested a deposit of **${formatMoney(parsedAmount, guildConfiguration.globalSettings)}** from account **${account}**.`
            )
        ]
      })
    } catch (err) {
      await deleteAtmRequest(requestId)
      throw err
    }

    await attachAtmRequestMessage(
      requestId,
      sendableLogChannel.id,
      logMessage.id
    )

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

    logger.event(
      {
        action: 'atm_deposit_requested',
        userId: interaction.user.id,
        requestId,
        amount: parsedAmount,
        guildId: interaction.guildId
      },
      'ATM deposit request created'
    )

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM - Deposit',
          `You have successfully deposited **${formatMoney(parsedAmount, guildConfiguration.globalSettings)}** to your account.\nPlease wait for the transaction to be processed.`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
