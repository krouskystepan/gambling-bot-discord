import {
  TGuildConfiguration,
  formatMoney,
  formatMoneyExact,
  generateId,
  isGlobalFeatureDisabled
} from 'gambling-bot-shared'

import { Colors, EmbedBuilder } from 'discord.js'

import { Client } from 'commandkit'

import {
  getGuildConfigByGuildId,
  payRaffleWinner,
  refundRafflePurchase
} from '@/services'
import {
  completeRaffleDraw,
  getRafflesReadyToDraw
} from '@/services/db/raffle.db'
import { sleep } from '@/utils/common/utils'
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

export const raffleDrawJob = async (client: Client<true>) => {
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

      if (isGlobalFeatureDisabled(guildConfig, 'raffleManagement')) {
        logger.worker(
          `[RAFFLE] Skipping draw — raffle management disabled (${raffle.guildId})`
        )
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

        for (const p of participants) {
          await refundRafflePurchase({
            userId: p.userId,
            guildId: raffle.guildId,
            amount: p.tickets * raffle.ticketPrice,
            raffleId: raffle.drawId
          })
        }
      } else {
        winnerId = pickWinner(participants)

        if (winnerId) {
          await payRaffleWinner({
            userId: winnerId,
            guildId: raffle.guildId,
            amount: pot,
            raffleId: raffle.drawId
          })
        }
      }

      const moneyMoved = refunded || winnerId !== null

      const channel = await client.channels
        .fetch(raffle.channelId)
        .catch(() => null)
      if (!channel?.isTextBased()) {
        if (moneyMoved) {
          logger.error(
            {
              raffleId: raffle.raffleId,
              guildId: raffle.guildId,
              channelId: raffle.channelId
            },
            'Raffle draw: Discord channel missing after settlement'
          )
        }
        continue
      }

      const raffleMessage = await channel.messages
        .fetch(raffle.raffleId)
        .catch(() => null)
      if (!raffleMessage) {
        if (moneyMoved) {
          logger.error(
            {
              raffleId: raffle.raffleId,
              guildId: raffle.guildId,
              messageId: raffle.raffleId
            },
            'Raffle draw: Discord message missing after settlement'
          )
        }
        continue
      }

      const thread = raffleMessage.hasThread
        ? raffleMessage.thread
        : await raffleMessage
            .startThread({
              name: '🎉 Raffle Results',
              autoArchiveDuration: 1440
            })
            .catch(() => null)

      if (!thread?.isTextBased()) {
        if (moneyMoved) {
          logger.error(
            {
              raffleId: raffle.raffleId,
              guildId: raffle.guildId,
              messageId: raffle.raffleId
            },
            'Raffle draw: Discord thread missing after settlement'
          )
        }
        continue
      }

      const resultEmbed = new EmbedBuilder()
        .setColor(
          refunded ? Colors.Orange : winnerId ? Colors.Gold : Colors.Red
        )
        .setTitle('🎉 Raffle Draw Result')
        .setDescription(
          refunded
            ? 'Not enough participants — all tickets refunded.'
            : winnerId
              ? `🏆 **Winner:** <@${winnerId}>\n🎟️ Tickets Sold: **${totalTickets}**\n💰 Pot: **${formatMoneyExact(pot, guildConfig.globalSettings)}**`
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
      const newBetId = generateId()

      const nextDrawUnix = Math.floor(nextDrawAt.getTime() / 1000)

      const resetEmbed = new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle('🎫 Global Raffle')
        .setDescription(
          `💰 Ticket Price: **${formatMoneyExact(raffle.ticketPrice, guildConfig.globalSettings)}**\n🎟️ Ticket Limit: **${raffle.maxTicketsPerUser}**\n\n🗓️ Next Draw: **<t:${nextDrawUnix}:F>**\n\n💸 Current Pot: **${formatMoney(0, guildConfig.globalSettings)}**`
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
          `Raffle "${raffle.raffleId}" winner ${winnerId} — pot ${formatMoneyExact(pot, guildConfig.globalSettings)}`
        )
      }

      await sleep(500)
    } catch (err) {
      logger.error(`[RAFFLE] Fatal error ${raffle.raffleId}`, err)
    }
  }
}
