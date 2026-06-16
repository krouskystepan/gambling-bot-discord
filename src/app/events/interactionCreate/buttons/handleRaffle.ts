import { formatMoney } from 'gambling-bot-shared/common'

import { Colors, EmbedBuilder, Interaction, MessageFlags } from 'discord.js'

import { handleUnexpectedButtonError } from '@/errors'
import {
  addRaffleTickets,
  assertGlobalFeature,
  assertNotMaintenance,
  getGuildConfigByGuildId,
  getRaffleById,
  spendCasinoBalance
} from '@/services'
import {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

export default async (interaction: Interaction) => {
  if (!interaction.isButton() || !interaction.customId) return

  const [type, raffleId, ticketAmountString] = interaction.customId.split('.')
  if (type !== 'raffle' || !raffleId) return

  const ticketAmount = Number(ticketAmountString || 1)

  try {
    const guildConfigEarly = await getGuildConfigByGuildId({
      guildId: interaction.guildId!
    })
    if (!guildConfigEarly) return
    if (!(await assertNotMaintenance(interaction, guildConfigEarly))) return
    if (
      !(await assertGlobalFeature(interaction, guildConfigEarly, 'raffles'))
    ) {
      return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

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

    const casinoSettings = guildConfigEarly.casinoSettings
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

    try {
      await spendCasinoBalance({
        userId: interaction.user.id,
        guildId: interaction.guildId!,
        amount: totalCost,
        betId: raffle.drawId,
        game: 'raffle'
      })
    } catch {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Insufficient Funds',
            `You need **${formatMoney(totalCost, guildConfigEarly.globalSettings)}** to buy tickets.`
          )
        ]
      })
    }

    const added = await addRaffleTickets({
      raffleId,
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      tickets: ticketAmount,
      maxTicketsPerUser: raffle.maxTicketsPerUser
    })

    if (!added) {
      // This should NEVER happen after validation
      throw new Error('RAFFLE_STATE_CHANGED_AFTER_VALIDATION')
    }

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

      const houseCut = guildConfigEarly.casinoSettings.raffle.casinoCut
      const pot = rawPot * (1 - houseCut)

      const drawUnix = Math.floor(
        new Date(updatedRaffle.nextDrawAt).getTime() / 1000
      )

      const updatedEmbed = new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle('🎫 Global Raffle')
        .setDescription(
          [
            `💰 Ticket Price: **${formatMoney(
              updatedRaffle.ticketPrice,
              guildConfigEarly.globalSettings
            )}**`,
            `🎟️ Ticket Limit: **${updatedRaffle.maxTicketsPerUser}**`,
            '',
            `🗓️ Drawing Date: **<t:${drawUnix}:F>**`,
            '',
            `💸 Current Pot: **${formatMoney(pot, guildConfigEarly.globalSettings)}**`
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
          `You bought **${ticketAmount}** ticket/s for **${formatMoney(
            totalCost,
            guildConfigEarly.globalSettings
          )}**`
        )
      ]
    })
  } catch (error) {
    await handleUnexpectedButtonError(interaction, error, {
      handler: 'handleRaffle'
    })
  }
}
