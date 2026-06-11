import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Interaction,
  MessageFlags,
  PermissionsBitField
} from 'discord.js'

import { handleUnexpectedButtonError } from '@/errors'
import {
  approveAtmRequest,
  getGuildConfigByGuildId,
  getPendingAtmRequest,
  rejectAtmRequest
} from '@/services'
import { createErrorEmbed } from '@/utils/discord/createEmbed'
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

    if (!guildConfig) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not Configured',
            'Guild configuration not found.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const result = isConfirmApprove
      ? await approveAtmRequest({
          requestId,
          handledBy: interaction.user.id,
          source: 'discord',
          client
        })
      : await rejectAtmRequest({
          requestId,
          handledBy: interaction.user.id,
          source: 'discord',
          client
        })

    if (!result.ok) {
      const messages: Record<typeof result.code, string> = {
        NOT_PENDING: 'This request is no longer pending.',
        RACE_CONDITION: 'Another admin already handled this at the same time.',
        INSUFFICIENT_BALANCE:
          'User no longer has enough available balance to approve this withdrawal.',
        GUILD_NOT_CONFIGURED: 'Guild configuration not found.',
        CREDIT_FAILED: 'Failed to credit user balance.'
      }

      return interaction.update({
        content: messages[result.code],
        components: []
      })
    }

    logger.event(
      {
        action: isConfirmApprove
          ? 'atm_request_approved'
          : 'atm_request_rejected',
        actorId: interaction.user.id,
        targetUserId: request.userId,
        requestId,
        requestType: request.type,
        amount: request.amount,
        guildId: request.guildId
      },
      `ATM ${request.type} ${isConfirmApprove ? 'approved' : 'rejected'}`
    )

    await interaction.update({
      content: `Transaction ${isConfirmApprove ? 'approved' : 'rejected'} successfully.`,
      components: []
    })
  } catch (error) {
    await handleUnexpectedButtonError(interaction, error, {
      handler: 'handleAtm'
    })
  }
}
