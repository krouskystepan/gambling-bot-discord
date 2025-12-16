import { TTransaction } from 'gambling-bot-shared'

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

import {
  createTransaction,
  getGuildConfigByGuildId,
  getUser,
  updateUserBalance
} from '@/services'
import { formatNumberToReadableString } from '@/utils/common/utils'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

export default async (interaction: Interaction, client: Client) => {
  if (!interaction.isButton() || !interaction.customId) return

  try {
    const [type, action, confirm, details, amountStr] =
      interaction.customId.split('.')
    if (!type || !action || !confirm || !details || !amountStr) return

    const [userId, messageId] = details.split('-')
    if (!userId || !messageId) return

    const [atmType, atmAction] = type.split('-')
    if (atmType !== 'atm') return

    const parsedAmount = parseInt(amountStr)
    if (isNaN(parsedAmount)) return

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
        embeds: [
          createErrorEmbed(
            'Permission Denied',
            `You need to be an **Administrator** or have the ${
              managerRoleId ? `<@&${managerRoleId}>` : '**Manager role**'
            } to perform this action.`
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const user = await getUser({
      userId: interaction.user.id,
      guildId: interaction.guildId!
    })
    if (!user) return

    const guildConfiguration = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    if (!guildConfiguration?.atmChannelIds.actions) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not Configured',
            'ATM actions are not configured yet.\nPlease contact an administrator to complete the setup.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const actionChannel = client.channels.cache.get(
      guildConfiguration.atmChannelIds.actions
    ) as TextChannel

    const updateLogMessage = async (content: string) => {
      try {
        const logChannel = (await client.channels.fetch(
          interaction.channelId
        )) as TextChannel
        const logMessage = await logChannel.messages.fetch(messageId)
        await logMessage.edit({ content, components: [] })
      } catch (err) {
        console.error('Failed to update log message', err)
      }
    }

    const sendConfirmation = async (
      label: string,
      style: ButtonStyle,
      customIdSuffix: string
    ) => {
      const button = new ButtonBuilder()
        .setCustomId(customIdSuffix)
        .setLabel(label)
        .setStyle(style)

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)
      await interaction.reply({
        content: 'Are you sure?',
        components: [row],
        flags: MessageFlags.Ephemeral
      })
    }

    const sendMessageToUser = async (
      isApproved: boolean,
      atmAction: string,
      amount: number,
      targetUserId: string
    ) => {
      const readableAmount = `$${formatNumberToReadableString(amount)}`

      const embed = isApproved
        ? createSuccessEmbed(
            'Transaction Approved ✅',
            `${
              atmAction === 'deposit' ? 'Deposit' : 'Withdraw'
            } of **${readableAmount}** has been approved.`
          )
        : createErrorEmbed(
            'Transaction Rejected ❌',
            `${
              atmAction === 'deposit' ? 'Deposit' : 'Withdraw'
            } of **${readableAmount}** has been rejected.`
          )

      await actionChannel
        .send({
          content: `<@${targetUserId}>`,
          embeds: [embed]
        })
        .catch(console.error)
    }

    if (action === 'approve' && confirm === '_') {
      return await sendConfirmation(
        atmAction === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdraw',
        ButtonStyle.Success,
        `atm-${atmAction}.approve.confirm.${userId}-${messageId}.${parsedAmount}`
      )
    }

    if (action === 'reject' && confirm === '_') {
      return await sendConfirmation(
        'Confirm Reject',
        ButtonStyle.Danger,
        `atm-${atmAction}.reject.confirm.${userId}-${messageId}.${parsedAmount}`
      )
    }

    if (confirm === 'confirm') {
      await updateUserBalance({
        userId: user.userId,
        guildId: user.guildId,
        amount:
          (action === 'approve' && atmAction === 'deposit') ||
          (action === 'reject' && atmAction === 'withdraw')
            ? parsedAmount
            : 0
      })

      if (action === 'approve') {
        await createTransaction({
          userId: user.userId,
          guildId: user.guildId,
          amount: parsedAmount,
          type: atmAction as TTransaction['type'],
          source: 'manual',
          handledBy: interaction.user.id
        })
      }

      await updateLogMessage(
        `${action === 'approve' ? 'Approved' : 'Rejected'} by <@${
          interaction.user.id
        }> ${action === 'approve' ? '✅' : '❌'}`
      )

      await sendMessageToUser(
        action === 'approve',
        atmAction,
        parsedAmount,
        userId
      )

      return await interaction.update({
        content: `${
          atmAction.charAt(0).toUpperCase() + atmAction.slice(1)
        } of **$${formatNumberToReadableString(parsedAmount)}** ${
          action === 'approve' ? 'successful' : 'rejected'
        }!`,
        components: []
      })
    }
  } catch (error) {
    console.error('Error in handleAtm.ts', error)
  }
}
