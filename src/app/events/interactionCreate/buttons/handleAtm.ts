import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Interaction,
  MessageFlags,
  PermissionsBitField,
  TextChannel
} from 'discord.js'

import { handleUnexpectedButtonError } from '@/errors'
import {
  completeAtmRequest,
  createTransaction,
  getGuildConfigByGuildId,
  getPendingAtmRequest,
  updateUserBalanceAtomic
} from '@/services'
import { formatNumberToReadableString } from '@/utils/common/utils'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export default async (interaction: Interaction, client: Client) => {
  if (!interaction.isButton()) return

  try {
    const [namespace, action, requestId] = interaction.customId.split('.')
    if (namespace !== 'atm' || !requestId) return

    const member = await interaction.guild?.members.fetch(interaction.user.id)
    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    const managerRoleId = guildConfig?.managerRoleId

    if (
      !member?.roles.cache.has(managerRoleId || '') &&
      !member?.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'Not authorized.')],
        flags: MessageFlags.Ephemeral
      })
    }

    if (action === 'approve' || action === 'reject') {
      const confirmId =
        action === 'approve'
          ? `atm.confirmApprove.${requestId}`
          : `atm.confirmReject.${requestId}`

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(confirmId)
          .setLabel(
            action === 'approve'
              ? 'Yes, approve transaction'
              : 'Yes, reject transaction'
          )
          .setStyle(
            action === 'approve' ? ButtonStyle.Success : ButtonStyle.Danger
          )
      )

      return interaction.reply({
        content: 'Are you sure you want to proceed?',
        components: [row],
        flags: MessageFlags.Ephemeral
      })
    }

    const isConfirmApprove = action === 'confirmApprove'
    const isConfirmReject = action === 'confirmReject'
    if (!isConfirmApprove && !isConfirmReject) return

    const finalAction = isConfirmApprove ? 'approve' : 'reject'

    const request = await getPendingAtmRequest(requestId)
    if (!request) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Already Handled',
            'This request is no longer pending.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const { userId, amount, type, guildId } = request
    const readableAmount = `$${formatNumberToReadableString(amount)}`

    if (finalAction === 'reject') {
      const completed = await completeAtmRequest({
        requestId,
        status: 'rejected',
        handledBy: interaction.user.id
      })

      if (!completed) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Race Condition Prevented',
              'Another admin already handled this.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }
    }

    if (type === 'deposit' && finalAction === 'approve') {
      const completed = await completeAtmRequest({
        requestId,
        status: 'approved',
        handledBy: interaction.user.id
      })

      if (!completed) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Race Condition Prevented',
              'Another admin already handled this.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const updatedUser = await updateUserBalanceAtomic({
        userId,
        guildId,
        balanceDelta: amount
      })

      if (!updatedUser) {
        return interaction.reply({
          embeds: [createErrorEmbed('Error', 'Failed to credit user balance.')],
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId,
        guildId,
        amount,
        type: 'deposit',
        source: 'manual',
        handledBy: interaction.user.id
      })
    }

    const actionChannel = client.channels.cache.get(
      guildConfig!.atmChannelIds.actions
    ) as TextChannel
    const logChannel = (await client.channels.fetch(
      request.logChannelId
    )) as TextChannel
    const logMessage = await logChannel.messages.fetch(request.logMessageId)

    if (type === 'withdraw' && finalAction === 'approve') {
      const updatedUser = await updateUserBalanceAtomic({
        userId,
        guildId,
        balanceDelta: -amount,
        requireAvailableGte: amount
      })

      if (!updatedUser) {
        const completed = await completeAtmRequest({
          requestId,
          status: 'rejected',
          handledBy: interaction.user.id
        })

        if (!completed) {
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                'Race Condition Prevented',
                'Another admin handled this before the balance check completed.'
              )
            ],
            flags: MessageFlags.Ephemeral
          })
        }

        await actionChannel.send({
          content: `<@${userId}>`,
          embeds: [
            createErrorEmbed(
              'Withdrawal Failed',
              `Your withdrawal of **${readableAmount}** could not be completed because your available balance changed before approval. Please submit a new request if funds are still available.`
            )
          ]
        })

        await logMessage.edit({
          content: `❌ Rejected by <@${interaction.user.id}> — user had insufficient available balance at time of approval.`,
          components: []
        })

        logger.event(
          {
            action: 'atm_withdraw_approve_failed',
            actorId: interaction.user.id,
            targetUserId: userId,
            requestId,
            amount,
            guildId
          },
          'ATM withdrawal approval failed — insufficient balance'
        )

        return interaction.update({
          content:
            'User no longer has enough available balance to approve this withdrawal.',
          components: []
        })
      }

      const completed = await completeAtmRequest({
        requestId,
        status: 'approved',
        handledBy: interaction.user.id
      })

      if (!completed) {
        // VERY RARE: request locked by someone else after balance changed
        // Refund money to keep system consistent
        await updateUserBalanceAtomic({
          userId,
          guildId,
          balanceDelta: amount
        })

        return interaction.reply({
          embeds: [
            createErrorEmbed(
              'Race Condition',
              'Another admin handled this at the same time. Balance has been restored.'
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      await createTransaction({
        userId,
        guildId,
        amount,
        type: 'withdraw',
        source: 'manual',
        handledBy: interaction.user.id
      })
    }

    try {
      await logMessage.edit({
        content:
          finalAction === 'approve'
            ? `✅ Approved by <@${interaction.user.id}>`
            : `❌ Rejected by <@${interaction.user.id}>`,
        components: []
      })
    } catch (err) {
      logger.error(
        { err, requestId, handler: 'handleAtm' },
        'Failed to update ATM log message'
      )
    }

    const actionWord = type === 'deposit' ? 'Deposit' : 'Withdrawal'

    const description = `${actionWord} of **${readableAmount}** ${
      finalAction === 'approve' ? 'approved' : 'rejected'
    }.`

    await actionChannel.send({
      content: `<@${userId}>`,
      embeds: [
        finalAction === 'approve'
          ? createSuccessEmbed('ATM Transaction Approved', description)
          : createErrorEmbed('ATM Transaction Rejected', description)
      ]
    })

    logger.event(
      {
        action:
          finalAction === 'approve' ? 'atm_request_approved' : 'atm_request_rejected',
        actorId: interaction.user.id,
        targetUserId: userId,
        requestId,
        requestType: type,
        amount,
        guildId
      },
      `ATM ${type} ${finalAction === 'approve' ? 'approved' : 'rejected'}`
    )

    await interaction.update({
      content: `Transaction ${finalAction === 'approve' ? 'approved' : 'rejected'} successfully.`,
      components: []
    })
  } catch (error) {
    await handleUnexpectedButtonError(interaction, error, {
      handler: 'handleAtm'
    })
  }
}
