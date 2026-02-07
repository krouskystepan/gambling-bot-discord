import { TGuildConfiguration } from 'gambling-bot-shared'

import { Client, Colors, EmbedBuilder } from 'discord.js'

import {
  createTransaction,
  getGuildConfigByGuildId,
  updateUserBalance
} from '@/services'
import {
  completeRaffleDraw,
  getRafflesReadyToDraw
} from '@/services/db/raffle.db'
import {
  formatNumberWithSpaces,
  generateBetId,
  sleep
} from '@/utils/common/utils'
import { logger } from '@/utils/logger'

const pickWinner = (participants: { userId: string; tickets: number }[]) => {
  const total = participants.reduce((s, p) => s + p.tickets, 0)
  if (total <= 0) return null

  let r = Math.random() * total
  for (const p of participants) {
    r -= p.tickets
    if (r <= 0) return p.userId
  }
  return null
}

export const raffleDrawJob = async (client: Client) => {
  const raffles = await getRafflesReadyToDraw()
  if (!raffles.length) return

  for (const raffle of raffles) {
    try {
      const guildConfig: TGuildConfiguration | null =
        await getGuildConfigByGuildId({ guildId: raffle.guildId })

      if (!guildConfig) {
        logger.error(`[RAFFLE] Missing guild config ${raffle.guildId}`)
        continue
      }

      const participants = raffle.participants.filter((p) => p.tickets > 0)
      const totalTickets = participants.reduce((s, p) => s + p.tickets, 0)
      const rawPot = totalTickets * raffle.ticketPrice
      const houseCut = guildConfig.casinoSettings.raffle.casinoCut
      const pot = rawPot * (1 - houseCut)

      let winnerId: string | null = null
      let refunded = false

      if (participants.length <= 1) {
        refunded = true

        for (const p of participants) {
          const refundAmount = p.tickets * raffle.ticketPrice

          await createTransaction({
            userId: p.userId,
            guildId: raffle.guildId,
            amount: refundAmount,
            type: 'refund',
            source: 'casino',
            betId: raffle.drawId
          })

          await updateUserBalance({
            userId: p.userId,
            guildId: raffle.guildId,
            amount: refundAmount
          })
        }
      } else {
        winnerId = pickWinner(participants)

        if (winnerId) {
          await createTransaction({
            userId: winnerId,
            guildId: raffle.guildId,
            amount: pot,
            type: 'win',
            source: 'casino',
            betId: raffle.drawId
          })

          await updateUserBalance({
            userId: winnerId,
            guildId: raffle.guildId,
            amount: pot
          })
        }
      }

      const channel = await client.channels
        .fetch(raffle.channelId)
        .catch(() => null)
      if (!channel?.isTextBased()) continue

      const raffleMessage = await channel.messages
        .fetch(raffle.raffleId)
        .catch(() => null)
      if (!raffleMessage) continue

      const thread = raffleMessage.hasThread
        ? raffleMessage.thread
        : await raffleMessage
            .startThread({
              name: '🎉 Raffle Results',
              autoArchiveDuration: 1440
            })
            .catch(() => null)

      if (!thread?.isTextBased()) continue

      const resultEmbed = new EmbedBuilder()
        .setColor(
          refunded ? Colors.Orange : winnerId ? Colors.Gold : Colors.Red
        )
        .setTitle('🎉 Raffle Draw Result')
        .setDescription(
          refunded
            ? 'Not enough participants — all tickets refunded.'
            : winnerId
              ? `🏆 **Winner:** <@${winnerId}>\n🎟️ Tickets Sold: **${totalTickets}**\n💰 Pot: **$${formatNumberWithSpaces(pot)}**`
              : 'No participants this round.'
        )
        .setFooter({ text: `ID: ${raffle.drawId}` })
        .setTimestamp()

      await thread.send({
        content: winnerId ? `<@${winnerId}>` : '',
        embeds: [resultEmbed]
      })

      const now = Date.now()
      const lastScheduled = raffle.nextDrawAt.getTime()
      const interval = raffle.drawIntervalMs
      const intervalsMissed = Math.floor((now - lastScheduled) / interval) + 1
      const nextDrawAt = new Date(lastScheduled + intervalsMissed * interval)
      const newBetId = generateBetId()

      const nextDrawUnix = Math.floor(nextDrawAt.getTime() / 1000)

      const resetEmbed = new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle('🎫 Global Raffle')
        .setDescription(
          `💰 Ticket Price: **$${raffle.ticketPrice.toLocaleString()}**\n🎟️ Ticket Limit: **${raffle.maxTicketsPerUser}**\n\n🗓️ Next Draw: **<t:${nextDrawUnix}:F>**\n\n💸 Current Pot: **$0**`
        )
        .setFooter({ text: `ID: ${newBetId}` })
        .setTimestamp()

      await raffleMessage.edit({ embeds: [resetEmbed] })

      await completeRaffleDraw({
        raffleId: raffle.raffleId,
        lastDrawAt: raffle.nextDrawAt,
        nextDrawAt,
        drawId: newBetId
      })

      if (refunded) {
        logger.worker(
          `Raffle "${raffle.raffleId}" refunded — ${participants.length} participant(s)`
        )
      } else if (winnerId) {
        logger.worker(
          `Raffle "${raffle.raffleId}" winner ${winnerId} — pot $${formatNumberWithSpaces(pot)}`
        )
      }

      await sleep(500)
    } catch (err) {
      logger.error(`[RAFFLE] Fatal error ${raffle.raffleId}`, err)
    }
  }
}
