import {
  Client,
  EmbedBuilder,
  Interaction,
  MessageFlags,
  TextChannel
} from 'discord.js'

import {
  getGuildConfigByGuildId,
  getUser,
  resetUserBalance,
  updateUserBalanceAtomic
} from '@/services'
import { formatNumberToReadableString } from '@/utils/common/utils'
import { createErrorEmbed, createInfoEmbed } from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

//! DB TRANSACTIONS
//! Rare condition - no .save()
export default async (interaction: Interaction, client: Client) => {
  if (!interaction.isButton() || !interaction.customId) return

  try {
    const [type, amount] = interaction.customId.split('.')

    if (type !== 'give-money' && type !== 'reset-money') return

    const guildConfiguration = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })

    if (!guildConfiguration?.atmChannelIds.logs) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not Configured',
            'ATM logs are not configured yet.\nPlease contact an administrator to complete the setup.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    const user = await getUser({
      guildId: interaction.guildId!,
      userId: interaction.user.id
    })

    if (!user) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            'Error - Not registered',
            'You are not registered yet.\nUse the `/register` command to register.'
          )
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (type === 'give-money') {
      if (!amount) return

      const parsedAmount = parseInt(amount)

      if (user.balance > parsedAmount * 5) {
        return interaction.reply({
          embeds: [
            createInfoEmbed(
              'Balance too high',
              `You can only receive money if your balance is below **$${formatNumberToReadableString(parsedAmount * 5)}**.`
            )
          ],
          flags: MessageFlags.Ephemeral
        })
      }

      const updatedUser = await updateUserBalanceAtomic({
        userId: interaction.user.id,
        guildId: interaction.guildId!,
        balanceDelta: parsedAmount
      })

      if (!updatedUser) return

      const logChannel = client.channels.cache.get(
        guildConfiguration.atmChannelIds.logs
      ) as TextChannel

      logChannel
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle('ATM - Money Generator')
              .setDescription(
                `<@${interaction.user.id}> has added **$${formatNumberToReadableString(
                  parsedAmount
                )}** to their account.`
              )
              .setColor('DarkGreen')
          ]
        })
        .catch((err) => logger.error('Failed to send the message', err))

      const embed = new EmbedBuilder()
        .setTitle('ATM - Money Generator')
        .setDescription(
          `Server has added **$${formatNumberToReadableString(
            parsedAmount
          )}** to your account.\nYour new balance is **$${formatNumberToReadableString(
            updatedUser.balance
          )}**.`
        )
        .setColor('DarkGreen')

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      })
    }

    if (type === 'reset-money') {
      const newUser = await resetUserBalance({
        userId: interaction.user.id,
        guildId: interaction.guildId!
      })

      if (!newUser) return

      const logChannel = client.channels.cache.get(
        guildConfiguration.atmChannelIds.logs
      ) as TextChannel

      logChannel
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle('ATM - Money Reset')
              .setDescription(
                `<@${interaction.user.id}> has reset their account balance.`
              )
              .setColor('DarkRed')
          ]
        })
        .catch((err) => logger.error('Failed to send the message', err))

      const embed = new EmbedBuilder()
        .setTitle('ATM - Money Reset')
        .setDescription(
          `Server has reset your account balance.\nYour new balance is **$${formatNumberToReadableString(
            newUser.balance
          )}**.`
        )
        .setColor('DarkRed')

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      })
    }
  } catch (error) {
    logger.error('Error in handleGiveMoney.ts', error)
  }
}
