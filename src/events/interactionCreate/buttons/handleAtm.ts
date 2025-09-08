import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Interaction,
  MessageFlags,
  PermissionsBitField,
  TextChannel,
} from 'discord.js'
import User from '../../../models/User'
import { formatNumberToReadableString } from '../../../utils/utils'
import GuildConfiguration from '../../../models/GuildConfiguration'
import {
  createErrorEmbed,
  createSuccessEmbed,
} from '../../../utils/createEmbed'

export default async (interaction: Interaction, client: Client) => {
  if (!interaction.isButton() || !interaction.customId) return

  try {
    const [type, action, confirm, details, amount] =
      interaction.customId.split('.')

    if (type !== 'atm') return
    if (!action || !action || !confirm || !details || !amount) return

    const [userId, messageId] = details.split('-')

    if (!userId || !messageId) return

    const member = await interaction.guild?.members.fetch(interaction.user.id)
    const guildConfig = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
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
            } to use this command.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }

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
            `atm.approve.confirm.${userId}-${messageId}.${parsedAmount}`
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
                  content: `Approved by <@${interaction.user.id}>✅`,
                  components: [],
                })
              }
            }

            if (!guildConfig?.transactionChannelId) return

            const transactionChannel = (await client.channels.fetch(
              guildConfig?.transactionChannelId
            )) as TextChannel

            if (transactionChannel) {
              transactionChannel.send({
                embeds: [
                  createSuccessEmbed(
                    'ATM - Admin Deposit via Automated Action',
                    `Manager <@${
                      interaction.user.id
                    }> successfully added **$${formatNumberToReadableString(
                      parsedAmount
                    )}** to <@${userId}>.\nTheir new balance is now: **$${formatNumberToReadableString(
                      user.balance
                    )}**.`
                  ),
                ],
              })
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
            `atm.reject.confirm.${userId}-${messageId}.${parsedAmount}`
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
                  content: `Rejected by <@${interaction.user.id}> ❌`,
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
