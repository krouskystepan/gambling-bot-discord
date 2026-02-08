import { Colors, EmbedBuilder, Interaction, MessageFlags } from 'discord.js'

import {
  addRaffleTickets,
  createTransaction,
  getGuildConfigByGuildId,
  getRaffleById,
  updateUserBalanceAtomic
} from '@/services'
import { formatNumberToReadableString } from '@/utils/common/utils'
import {
  createInfoEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

export default async (interaction: Interaction) => {
  if (!interaction.isButton() || !interaction.customId) return

  const [type, raffleId, ticketAmountString] = interaction.customId.split('.')
  if (type !== 'raffle' || !raffleId) return

  const ticketAmount = Number(ticketAmountString || 1)

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  try {
    const raffle = await getRaffleById({
      raffleId,
      guildId: interaction.guildId!
    })
    if (!raffle || !interaction.channel) return

    if (raffle.status === 'canceled') {
      return interaction.editReply({
        embeds: [
          createInfoEmbed('Raffle Canceled', 'This raffle is no longer active.')
        ]
      })
    }

    if (new Date() >= new Date(raffle.nextDrawAt)) {
      return interaction.editReply({
        embeds: [
          createInfoEmbed(
            'Raffle Closed',
            'Ticket sales are closed for this raffle.'
          )
        ]
      })
    }

    const guildConfig = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    const casinoSettings = guildConfig?.casinoSettings
    if (!casinoSettings) return

    const existingEntry = raffle.participants.find(
      (p) => p.userId === interaction.user.id
    )

    const currentTickets = existingEntry ? existingEntry.tickets : 0

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

    const totalCost = raffle.ticketPrice * ticketAmount

    const added = await addRaffleTickets({
      raffleId,
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      tickets: ticketAmount,
      maxTicketsPerUser: raffle.maxTicketsPerUser
    })

    if (!added) {
      return interaction.editReply({
        embeds: [
          createInfoEmbed(
            'Ticket Limit Reached',
            'You cannot buy more tickets for this raffle.'
          )
        ]
      })
    }

    const updatedUser = await updateUserBalanceAtomic({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      balanceDelta: -totalCost,
      lockedDelta: 0,
      requireAvailableGte: totalCost
    })

    if (!updatedUser) {
      await addRaffleTickets({
        raffleId,
        guildId: interaction.guildId!,
        userId: interaction.user.id,
        tickets: -ticketAmount,
        maxTicketsPerUser: raffle.maxTicketsPerUser
      })

      return interaction.editReply({
        embeds: [
          createInfoEmbed(
            'Insufficient Funds',
            `You need **$${formatNumberToReadableString(totalCost)}** available to buy tickets.`
          )
        ]
      })
    }

    await createTransaction({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      amount: totalCost,
      type: 'bet',
      source: 'casino',
      betId: raffle.drawId
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
      const rawPot = totalTickets * raffle.ticketPrice

      const houseCut = guildConfig.casinoSettings.raffle.casinoCut
      const pot = rawPot * (1 - houseCut)

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
        .setFooter({ text: `ID: ${raffle.drawId}` })

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
          'Ticket/s Purchased',
          `You bought **${ticketAmount}** ticket/s for **$${formatNumberToReadableString(
            totalCost
          )}**`
        )
      ]
    })
  } catch (error) {
    logger.error('Error in handleRaffle.ts', error)
  }
}
