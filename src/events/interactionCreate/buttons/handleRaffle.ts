import { Colors, EmbedBuilder, Interaction, MessageFlags } from 'discord.js'

import {
  consumeUserBalance,
  createTransaction,
  getGuildConfigByGuildId
} from '@/services'
import { addRaffleTickets, getRaffleById } from '@/services/db/raffle.db'
import { formatNumberToReadableString } from '@/utils/common/utils'
import {
  createInfoEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export default async (interaction: Interaction) => {
  if (!interaction.isButton() || !interaction.customId) return

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  try {
    const [type, raffleId] = interaction.customId.split('.')
    if (type !== 'raffle' || !raffleId) return

    const raffle = await getRaffleById({
      raffleId,
      guildId: interaction.guildId!
    })

    if (!raffle || !interaction.channel) return

    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    const casinoSettings = guildConfig?.casinoSettings
    if (!casinoSettings) return

    const existingEntry = raffle.participants.find(
      (p) => p.userId === interaction.user.id
    )

    const currentTickets = existingEntry ? existingEntry.tickets : 0
    const ticketAmount = 1

    if (
      raffle.maxTicketsPerUser > 0 &&
      currentTickets + ticketAmount > raffle.maxTicketsPerUser
    ) {
      return interaction.editReply({
        embeds: [
          createInfoEmbed(
            'Ticket Limit Exceeded',
            `Maximum tickets per user is **${raffle.maxTicketsPerUser}**.`
          )
        ]
      })
    }

    const updatedUser = await consumeUserBalance({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      amount: raffle.ticketPrice
    })

    if (!updatedUser) {
      return interaction.editReply({
        embeds: [
          createInfoEmbed(
            'Insufficient Funds',
            `You need **$${formatNumberToReadableString(
              raffle.ticketPrice
            )}** to buy ticket.`
          )
        ]
      })
    }

    await createTransaction({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      amount: raffle.ticketPrice,
      type: 'bet',
      source: 'casino',
      betId: raffleId
    })

    await addRaffleTickets({
      raffleId,
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      tickets: 1
    })

    const updatedRaffle = await getRaffleById({
      raffleId,
      guildId: interaction.guildId!
    })

    if (updatedRaffle) {
      const totalTickets = updatedRaffle.participants.reduce(
        (sum, p) => sum + p.tickets,
        0
      )

      const pot = totalTickets * raffle.ticketPrice

      const drawUnix = Math.floor(
        new Date(updatedRaffle.nextDrawAt).getTime() / 1000
      )

      const updatedEmbed = new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle('🎫 Global Raffle')
        .setDescription(
          [
            `💰 Ticket Price: **$${formatNumberToReadableString(
              updatedRaffle.ticketPrice
            )}**`,
            `🎟️ Ticket Limit: **${updatedRaffle.maxTicketsPerUser}**`,
            '',
            `🗓️ Drawing Date: **<t:${drawUnix}:F>**`,
            '',
            `💸 Current Pot: **$${formatNumberToReadableString(pot)}**`
          ].join('\n')
        )
        .setFooter({ text: `ID: ${raffleId}` })

      const raffleMessage = await interaction.channel.messages
        .fetch(updatedRaffle.raffleId)
        .catch(() => null)

      if (raffleMessage) {
        await raffleMessage.edit({ embeds: [updatedEmbed] })
      }
    }

    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          'Ticket Purchased',
          `You bought **1** ticket for **$${formatNumberToReadableString(
            raffle.ticketPrice
          )}**`
        )
      ]
    })
  } catch (error) {
    logger.error('Error in handleRaffle.ts', error)
  }
}
