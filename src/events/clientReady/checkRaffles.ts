import { Client, Colors, EmbedBuilder } from 'discord.js'

import { createTransaction, updateUserBalance } from '@/services'
import {
  completeRaffleDraw,
  getRafflesReadyToDraw
} from '@/services/db/raffle.db'
import { logger } from '@/utils/logger'

const ONE_MINUTE = 60 * 1000

const pickWinner = (participants: { userId: string; tickets: number }[]) => {
  const pool: string[] = []

  for (const p of participants) {
    for (let i = 0; i < p.tickets; i++) pool.push(p.userId)
  }

  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

const processRaffles = async (client: Client) => {
  const raffles = await getRafflesReadyToDraw()
  if (!raffles.length) return

  for (const raffle of raffles) {
    try {
      const winnerId = pickWinner(raffle.participants)

      const totalTickets = raffle.participants.reduce(
        (sum, p) => sum + p.tickets,
        0
      )

      const pot = totalTickets * raffle.ticketPrice

      if (winnerId && pot > 0) {
        await createTransaction({
          userId: winnerId,
          guildId: raffle.guildId,
          amount: pot,
          type: 'win',
          source: 'casino',
          betId: raffle.raffleId
        })

        await updateUserBalance({
          userId: winnerId,
          guildId: raffle.guildId,
          amount: pot
        })
      }

      const channel = await client.channels
        .fetch(raffle.channelId)
        .catch(() => null)
      if (!channel || !channel.isTextBased()) continue

      const raffleMessage = await channel.messages
        .fetch(raffle.raffleId)
        .catch(() => null)

      if (!raffleMessage) continue

      const thread = raffleMessage.hasThread
        ? raffleMessage.thread
        : await raffleMessage.startThread({
            name: '🎉 Raffle Results',
            autoArchiveDuration: 1440
          })

      if (!thread || !thread.isTextBased()) continue

      const resultEmbed = new EmbedBuilder()
        .setColor(winnerId ? Colors.Gold : Colors.Red)
        .setTitle('🎉 Raffle Draw Result')
        .setDescription(
          winnerId
            ? [
                `🏆 **Winner:** <@${winnerId}>`,
                `🎟️ Tickets Sold: **${totalTickets}**`,
                `💰 Pot: **$${pot.toLocaleString()}**`
              ].join('\n')
            : 'No participants this round.'
        )
        .setTimestamp()

      await thread.send({ embeds: [resultEmbed] })

      const nextDrawAt = new Date(
        raffle.nextDrawAt.getTime() + raffle.drawIntervalMs
      )
      const nextDrawUnix = Math.floor(nextDrawAt.getTime() / 1000)

      const resetEmbed = new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle('🎫 Global Raffle')
        .setDescription(
          [
            `💰 **Ticket Price:** $${raffle.ticketPrice.toLocaleString()}`,
            `🎟️ **Ticket Limit:** ${raffle.maxTicketsPerUser}`,
            '',
            `🗓️ **Next Draw:** <t:${nextDrawUnix}:F>`,
            '',
            '💸 Current Pot: **$0**'
          ].join('\n')
        )
        .setFooter({ text: `ID: ${raffle.raffleId}` })
        .setTimestamp()

      await raffleMessage.edit({ embeds: [resetEmbed] })

      await completeRaffleDraw({
        raffleId: raffle.raffleId,
        lastDrawAt: raffle.nextDrawAt,
        nextDrawAt
      })
    } catch (err) {
      logger.error(`Failed processing raffle ${raffle.raffleId}`, err)
    }
  }
}

export default async (client: Client) => {
  logger.boot('⌛ Raffle auto-draw worker started')
  setInterval(() => processRaffles(client), ONE_MINUTE)
}
