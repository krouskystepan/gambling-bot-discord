import {
  Client,
  EmbedBuilder,
  GuildMember,
  Interaction,
  MessageFlags,
  TextChannel,
} from 'discord.js'
import User from '../../../models/User'
import { formatNumberToReadableString } from '../../../utils/utils'
import GuildConfiguration from '../../../models/GuildConfiguration'

export default async (interaction: Interaction, client: Client) => {
  if (!interaction.isButton() || !interaction.customId) return

  try {
    const [type, amount] = interaction.customId.split('.')

    if (!type || !amount) return
    if (type !== 'give-money') return

    const guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (!guildConfiguration?.atmChannelIds.logs) {
      return await interaction.reply({
        content: 'ATM log channel is not set.',
        flags: MessageFlags.Ephemeral,
      })
    }

    const parsedAmount = parseInt(amount)

    const user = await User.findOne({
      userId: interaction.user.id,
      guildId: interaction.guildId,
    })

    if (!user) return

    user.balance += parsedAmount
    user.save()

    const logChannel = client.channels.cache.get(
      guildConfiguration.atmChannelIds.logs
    ) as TextChannel

    logChannel
      .send({
        embeds: [
          new EmbedBuilder()
            .setTitle('ATM - Money Generator')
            .setDescription(
              `<@${
                interaction.user.id
              }> has added **$${formatNumberToReadableString(
                parsedAmount
              )}** to their account.`
            )
            .setColor('Gold'),
        ],
      })
      .catch(console.error)

    const embed = new EmbedBuilder()
      .setTitle('ATM - Money Generator')
      .setDescription(
        `Server has added **$${formatNumberToReadableString(
          parsedAmount
        )}** to your account.\nYour new balance is **$${formatNumberToReadableString(
          user.balance
        )}**.`
      )
      .setColor('Gold')

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    })
  } catch (error) {
    console.error('Error in handlePrediction.ts', error)
  }
}
