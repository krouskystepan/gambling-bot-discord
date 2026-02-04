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
import { formatNumberWithSpaces, generateBetId } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

const ONE_MINUTE = 60 * 1000

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

const processRaffles = async (client: Client) => {
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

      if (participants.length === 1) {
        refunded = true

        await Promise.all(
          participants.map((p) => {
            const refundAmount = p.tickets * raffle.ticketPrice
            return Promise.all([
              createTransaction({
                userId: p.userId,
                guildId: raffle.guildId,
                amount: refundAmount,
                type: 'refund',
                source: 'casino',
                betId: raffle.drawId
              }),
              updateUserBalance({
                userId: p.userId,
                guildId: raffle.guildId,
                amount: refundAmount
              })
            ])
          })
        )
      } else {
        winnerId = pickWinner(participants)

        if (winnerId) {
          await Promise.all([
            createTransaction({
              userId: winnerId,
              guildId: raffle.guildId,
              amount: pot,
              type: 'win',
              source: 'casino',
              betId: raffle.drawId
            }),
            updateUserBalance({
              userId: winnerId,
              guildId: raffle.guildId,
              amount: pot
            })
          ])
        }
      }

      const channel = await client.channels
        .fetch(raffle.channelId)
        .catch((err) => {
          logger.error(`[RAFFLE] Channel fetch failed ${raffle.channelId}`, err)
          return null
        })
      if (!channel || !channel.isTextBased()) continue

      const raffleMessage = await channel.messages
        .fetch(raffle.raffleId)
        .catch((err) => {
          logger.error(`[RAFFLE] Message fetch failed ${raffle.raffleId}`, err)
          return null
        })
      if (!raffleMessage) continue

      const thread = raffleMessage.hasThread
        ? raffleMessage.thread
        : await raffleMessage
            .startThread({
              name: '🎉 Raffle Results',
              autoArchiveDuration: 1440
            })
            .catch((err) => {
              logger.error(
                `[RAFFLE] Thread creation failed ${raffle.raffleId}`,
                err
              )
              return null
            })

      if (!thread || !thread.isTextBased()) continue

      const resultEmbed = new EmbedBuilder()
        .setColor(
          refunded ? Colors.Orange : winnerId ? Colors.Gold : Colors.Red
        )
        .setTitle('🎉 Raffle Draw Result')
        .setDescription(
          refunded
            ? 'Not enough participants — all tickets refunded.'
            : winnerId
              ? [
                  `🏆 **Winner:** <@${winnerId}>`,
                  `🎟️ Tickets Sold: **${totalTickets}**`,
                  `💰 Pot: **$${formatNumberWithSpaces(pot)}**`
                ].join('\n')
              : 'No participants this round.'
        )
        .setFooter({ text: `ID: ${raffle.drawId}` })
        .setTimestamp()

      await thread
        .send({
          content: winnerId ? `<@${winnerId}>` : '',
          embeds: [resultEmbed]
        })
        .catch((err) => logger.error(`[RAFFLE] Thread send failed`, err))

      const now = Date.now()
      const lastScheduled = raffle.nextDrawAt.getTime()
      const interval = raffle.drawIntervalMs
      const intervalsMissed = Math.floor((now - lastScheduled) / interval) + 1
      const nextDrawAt = new Date(lastScheduled + intervalsMissed * interval)
      const nextDrawUnix = Math.floor(nextDrawAt.getTime() / 1000)
      const newBetId = generateBetId()

      const resetEmbed = new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle('🎫 Global Raffle')
        .setDescription(
          [
            `💰 Ticket Price: **$${raffle.ticketPrice.toLocaleString()}**`,
            `🎟️ Ticket Limit: **${raffle.maxTicketsPerUser}**`,
            '',
            `🗓️ Next Draw: **<t:${nextDrawUnix}:F>**`,
            '',
            '💸 Current Pot: **$0**'
          ].join('\n')
        )
        .setFooter({ text: `ID: ${newBetId}` })
        .setTimestamp()

      await raffleMessage
        .edit({ embeds: [resetEmbed] })
        .catch((err) => logger.error(`[RAFFLE] Message edit failed`, err))

      await completeRaffleDraw({
        raffleId: raffle.raffleId,
        lastDrawAt: raffle.nextDrawAt,
        nextDrawAt,
        drawId: newBetId
      })

      refunded
        ? logger.worker(`Raffle ${raffle.raffleId} refunded`)
        : winnerId
          ? logger.worker(`Raffle ${raffle.raffleId} winner ${winnerId}`)
          : null
    } catch (err) {
      logger.error(`[RAFFLE] Fatal error ${raffle.raffleId}`, err)
    }
  }
}

export default async (client: Client) => {
  logger.boot('⌛ Raffle auto-draw worker started')

  setInterval(() => processRaffles(client), ONE_MINUTE)
}
