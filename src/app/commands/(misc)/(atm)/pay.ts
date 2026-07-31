import {
  formatMoney,
  formatNumberToPercentage,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'
import { normalizePaySettings } from 'gambling-bot-shared/pay'
import { USER_BANNED_MESSAGE } from 'gambling-bot-shared/user'

import { ApplicationCommandOptionType, MessageFlags } from 'discord.js'

import { ChatInputCommand, CommandData } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  assertGlobalFeature,
  assertNotBanned,
  checkAtmChannels,
  checkTargetUserRegistration,
  checkUserRegistration,
  peerTransfer
} from '@/services'
import { isUserOnCooldown } from '@/utils/common/userCooldown'
import { checkValidBet } from '@/utils/common/utils'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export const command: CommandData = {
  name: 'pay',
  description: 'Send money to another registered user.',
  options: [
    {
      name: 'user',
      description: 'The user to pay.',
      type: ApplicationCommandOptionType.User,
      required: true
    },
    {
      name: 'amount',
      description: 'Amount to send (e.g. 1000, 2k, 4.5k).',
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

    if (isUserOnCooldown(user.userId)) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Slow Down',
            'Wait a moment before sending another payment.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const targetDiscordUser = interaction.options.getUser('user', true)
    const targetUser = await checkTargetUserRegistration({
      interaction,
      targetUserId: targetDiscordUser.id
    })
    if (!targetUser) return

    if (interaction.user.id === targetDiscordUser.id || targetDiscordUser.bot) {
      return interaction.reply({
        embeds: [
          createErrorEmbed('Invalid Input', 'You cannot pay this user.')
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (!(await assertNotBanned({ user: targetUser, interaction }))) return

    const guildConfiguration = await checkAtmChannels(interaction)
    if (!guildConfiguration) return
    if (
      !(await assertGlobalFeature(
        interaction,
        guildConfiguration,
        'peerTransfers'
      ))
    ) {
      return
    }

    const amount = parseReadableStringToNumber(
      interaction.options.getString('amount', true)
    )
    const paySettings = normalizePaySettings(guildConfiguration.paySettings)
    const globalSettings = guildConfiguration.globalSettings

    if (
      !checkValidBet(
        interaction,
        amount,
        paySettings.maxAmount,
        paySettings.minAmount,
        globalSettings
      )
    ) {
      return
    }

    let result
    try {
      result = await peerTransfer.transfer({
        senderId: interaction.user.id,
        receiverId: targetDiscordUser.id,
        guildId: interaction.guildId!,
        amount,
        paySettings,
        timezone: globalSettings?.timezone
      })
    } catch (err) {
      const code = err instanceof Error ? err.message : 'UNKNOWN'

      if (code === 'INSUFFICIENT_FUNDS') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Funds',
              `You don't have enough funds to send **${formatMoney(amount, globalSettings)}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (code === 'INSUFFICIENT_WITHDRAWABLE') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Insufficient Available Funds',
              `You don't have enough available (unlocked) balance to send **${formatMoney(amount, globalSettings)}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (code === 'DAILY_CAP_EXCEEDED') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Daily Limit Reached',
              `Sending **${formatMoney(amount, globalSettings)}** would exceed your daily transfer limit of **${formatMoney(paySettings.maxDailyAmount, globalSettings)}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (code === 'USER_BANNED') {
        return interaction.reply({
          embeds: [createErrorEmbed('Account Restricted', USER_BANNED_MESSAGE)],
          flags: MessageFlags.Ephemeral
        })
      }

      if (code === 'SELF_TRANSFER') {
        return interaction.reply({
          embeds: [
            createErrorEmbed('Invalid Input', 'You cannot pay yourself.')
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      if (code === 'SENDER_NOT_FOUND' || code === 'RECEIVER_NOT_FOUND') {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'User Not Found',
              'One of the users is no longer registered.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      throw err
    }

    const feeLabel =
      result.fee > 0
        ? `\nFee (**${formatNumberToPercentage(result.feePercent)}**): **${formatMoney(result.fee, globalSettings)}**`
        : ''

    const successEmbed = createSuccessEmbed(
      'Payment Sent',
      `You sent **${formatMoney(result.gross, globalSettings)}** to <@${targetDiscordUser.id}>.${feeLabel}\nThey received **${formatMoney(result.net, globalSettings)}**.\n\nYour balance: **${formatMoney(result.senderBalance, globalSettings)}**`,
      result.referenceId
    )

    await interaction.reply({
      embeds: [successEmbed],
      flags: MessageFlags.Ephemeral
    })

    try {
      await targetDiscordUser.send({
        embeds: [
          createSuccessEmbed(
            'Payment Received',
            `You received **${formatMoney(result.net, globalSettings)}** from <@${interaction.user.id}>.${
              result.fee > 0
                ? `\n(Gross sent: **${formatMoney(result.gross, globalSettings)}**, fee: **${formatMoney(result.fee, globalSettings)}**)`
                : ''
            }\n\nYour balance: **${formatMoney(result.receiverBalance, globalSettings)}**`,
            result.referenceId
          )
        ]
      })
    } catch {
      // DMs closed / blocked - sender still got success
    }

    logger.event(
      {
        action: 'peer_transfer',
        userId: interaction.user.id,
        targetUserId: targetDiscordUser.id,
        amount: result.gross,
        fee: result.fee,
        net: result.net,
        referenceId: result.referenceId,
        guildId: interaction.guildId
      },
      'Peer transfer completed'
    )
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
