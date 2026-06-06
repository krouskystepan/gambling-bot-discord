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
  deleteAtmRequest,
  previewWithdraw
} from '@/services'
import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
  name: 'withdraw',
  description: 'Withdraw money from your account.',
  options: [
    {
      name: 'amount',
      description: 'The amount you want to withdraw (e.g., 1000, 2k, 10.5k).',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'account',
      description: 'The account you want to send the money to.',
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
      !(await assertGlobalFeature(interaction, guildConfiguration, 'withdraw'))
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

    const preview = await previewWithdraw({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      amount: parsedAmount
    })

    if (!preview.ok) {
      if (preview.reason === 'INSUFFICIENT_BALANCE') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Funds',
              `You don't have enough funds to withdraw **${formatMoney(parsedAmount, guildConfiguration.globalSettings)}**.\nYour current balance is **${formatMoney(preview.balance, guildConfiguration.globalSettings)}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (preview.reason === 'INSUFFICIENT_WITHDRAWABLE') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Withdrawable Funds',
              `You requested **${formatMoney(parsedAmount, guildConfiguration.globalSettings)}**, but you can only withdraw **${formatMoney(preview.withdrawable, guildConfiguration.globalSettings)}**.\n` +
                `**${formatMoney(preview.locked, guildConfiguration.globalSettings)}** is currently locked.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'Unable to process withdrawal.')],
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

    const requestId = generateId()

    await createAtmRequest({
      requestId,
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      type: 'withdraw',
      amount: parsedAmount,
      account
    })

    const member = interaction.member as GuildMember | null
    const displayName =
      member?.displayName ||
      interaction.user.globalName ||
      interaction.user.username

    const managerRole = guildConfiguration.managerRoleId

    let logMessage: Message<true>

    try {
      logMessage = await sendableLogChannel.send({
        content: managerRole ? `<@&${managerRole}>` : '',
        embeds: [
          new EmbedBuilder()
            .setTitle(
              `ATM - Withdrawal by ${displayName} (${interaction.user.username})`
            )
            .setColor('Red')
            .setDescription(
              `<@${interaction.user.id}> requested a withdrawal of **${formatMoney(parsedAmount, guildConfiguration.globalSettings)}** to account **${account}**.`
            )
        ],
        components: []
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

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`atm.approve.${requestId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`atm.reject.${requestId}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger)
    )

    await logMessage.edit({ components: [row] })

    logger.event(
      {
        action: 'atm_withdraw_requested',
        userId: interaction.user.id,
        requestId,
        amount: parsedAmount,
        guildId: interaction.guildId
      },
      'ATM withdrawal request created'
    )

    return interaction.reply({
      embeds: [
        createSuccessEmbed(
          'ATM - Withdraw',
          `You have requested to withdraw **${formatMoney(parsedAmount, guildConfiguration.globalSettings)}**.\nPlease wait for the transaction to be processed.`
        )
      ],
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
