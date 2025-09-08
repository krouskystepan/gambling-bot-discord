import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Interaction,
  MessageFlags,
  TextChannel,
} from 'discord.js'
import User from '../../../models/User'
import { formatNumberToReadableString } from '../../../utils/utils'

export default async (interaction: Interaction, client: Client) => {
  if (!interaction.isButton() || !interaction.customId) return

  try {
    const [type, action, confirm, details, amount] =
      interaction.customId.split('.')

    if (type !== 'atm') return
    if (!action || !action || !confirm || !details || !amount) return

    const [userId, messageId] = details.split('-')

    if (!userId || !messageId) return

    const user = await User.findOne({
      userId,
      guildId: interaction.guildId,
    })

    if (!user) return

    const parsedAmount = parseInt(amount)

    if (action === 'approve') {
      if (confirm === '_') {
        const confirmButton = new ButtonBuilder()
          .setCustomId(
            `atm.approve.confirm.${interaction.user.id}-${messageId}.${parsedAmount}`
          )
          .setLabel('Confirm Deposit')
          .setStyle(ButtonStyle.Success)

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          confirmButton
        )

        await interaction.reply({
          content: 'Are you sure?',
          components: [row],
          flags: MessageFlags.Ephemeral,
        })
      }

      if (confirm === 'confirm') {
        user.balance += parsedAmount
        await user.save()

        if (messageId) {
          try {
            const logChannel = (await client.channels.fetch(
              interaction.channelId
            )) as TextChannel

            if (logChannel) {
              const logMessage = await logChannel.messages.fetch(messageId)
              if (logMessage) {
                await logMessage.edit({
                  content: 'Approved ✅',
                  components: [],
                })
              }
            }
          } catch (err) {
            console.error('Failed to remove buttons from log message', err)
          }
        }

        await interaction.update({
          content: `Deposit of **$${formatNumberToReadableString(
            parsedAmount
          )}** successful!`,
          components: [],
        })
      }
    }

    if (action === 'reject') {
      if (confirm === '_') {
        const confirmButton = new ButtonBuilder()
          .setCustomId(
            `atm.reject.confirm.${interaction.user.id}-${messageId}.${parsedAmount}`
          )
          .setLabel('Confirm Reject')
          .setStyle(ButtonStyle.Danger)

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          confirmButton
        )

        await interaction.reply({
          content: 'Are you sure?',
          components: [row],
          flags: MessageFlags.Ephemeral,
        })
      }

      if (confirm === 'confirm') {
        if (messageId) {
          try {
            const logChannel = (await client.channels.fetch(
              interaction.channelId
            )) as TextChannel

            if (logChannel) {
              const logMessage = await logChannel.messages.fetch(messageId)
              if (logMessage) {
                await logMessage.edit({
                  content: 'Rejected ❌',
                  components: [],
                })
              }
            }
          } catch (err) {
            console.error('Failed to remove buttons from log message', err)
          }
        }

        await interaction.update({
          content: `Deposit of **$${formatNumberToReadableString(
            parsedAmount
          )}** successful!`,
          components: [],
        })
      }
    }
  } catch (error) {
    console.error('Error in handleGiveMoney.ts', error)
  }
}
