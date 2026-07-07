import {
  formatMoney,
  formatMoneyExact,
  generateId
} from 'gambling-bot-shared/common'
import {
  TGuildConfiguration,
  isGlobalFeatureDisabled
} from 'gambling-bot-shared/guild'

import { Colors, EmbedBuilder } from 'discord.js'

import { Client } from 'commandkit'

import {
  type RaffleDrawOutcome,
  calculateRaffleDrawSummary,
  getGuildConfigByGuildId,
  payRaffleWinner,
  postRaffleDrawLog,
  refundRafflePurchase
} from '@/services'
import {
  completeRaffleDraw,
  getRafflesReadyToDraw
} from '@/services/db/raffle.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

type RaffleReady = Awaited<ReturnType<typeof getRafflesReadyToDraw>>[number]

type RaffleCycle = {
  nextDrawAt: Date
  drawId: string
  lastDrawAt: Date
}

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

const computeNextRaffleCycle = (raffle: RaffleReady): RaffleCycle => {
  const now = Date.now()
  const lastScheduled = raffle.nextDrawAt.getTime()
  const interval = raffle.drawIntervalMs
  const intervalsMissed = Math.floor((now - lastScheduled) / interval) + 1

  return {
    nextDrawAt: new Date(lastScheduled + intervalsMissed * interval),
    drawId: generateId(),
    lastDrawAt: raffle.nextDrawAt
  }
}

const advanceRaffleSchedule = async (
  raffle: RaffleReady,
  cycle: RaffleCycle
) => {
  await completeRaffleDraw({
    raffleId: raffle.raffleId,
    lastDrawAt: cycle.lastDrawAt,
    nextDrawAt: cycle.nextDrawAt,
    drawId: cycle.drawId
  })
}

const postRaffleWorkerLog = async (
  client: Client<true>,
  {
    raffle,
    guildConfig,
    refunded,
    winnerId,
    participants,
    pot,
    discordIssue
  }: {
    raffle: RaffleReady
    guildConfig: TGuildConfiguration
    refunded: boolean
    winnerId: string | null
    participants: { userId: string; tickets: number }[]
    pot: number
    discordIssue?: 'channel' | 'message' | 'thread'
  }
) => {
  let title: string
  let description: string
  let level: 'info' | 'success' | 'warning' = 'info'

  if (refunded) {
    title = 'Tickets refunded'
    description = `Raffle \`${raffle.raffleId}\` had only **${participants.length}** player(s). Everyone got their money back.`
    level = 'warning'
  } else if (winnerId) {
    title = 'Winner picked'
    description = [
      `<@${winnerId}> won **${formatMoneyExact(pot, guildConfig.globalSettings)}**.`,
      `Raffle: \`${raffle.raffleId}\``,
      `Tickets sold: **${participants.reduce((sum, p) => sum + p.tickets, 0)}**`
    ].join('\n')
    level = 'success'
  } else {
    title = 'Round finished'
    description = `Raffle \`${raffle.raffleId}\` had no tickets this round.`
  }

  if (discordIssue) {
    const target =
      discordIssue === 'channel'
        ? 'the raffle channel'
        : discordIssue === 'message'
          ? 'the raffle message'
          : 'the results thread'
    description += `\n\nThe bot could not post in ${target}.`
    level = 'warning'
  }

  if (!refunded && !winnerId && !discordIssue) return

  if (refunded) {
    logger.worker(
      `Raffle "${raffle.raffleId}" refunded - ${participants.length} participant(s)`
    )
  } else if (winnerId) {
    logger.worker(
      `Raffle "${raffle.raffleId}" winner ${winnerId} - pot ${formatMoneyExact(pot, guildConfig.globalSettings)}`
    )
  } else if (discordIssue) {
    logger.worker(
      `Raffle "${raffle.raffleId}" draw advanced; Discord ${discordIssue} unavailable`
    )
  }

  await postWorkerLog(client, {
    guildId: raffle.guildId,
    worker: 'Raffles',
    title,
    description,
    level
  })
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
          `[RAFFLE] Skipping draw - raffle management disabled (${raffle.guildId})`
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
            raffleId: raffle.drawId,
            game: 'raffle'
          })
        }
      } else {
        winnerId = pickWinner(participants)

        if (winnerId) {
          await payRaffleWinner({
            userId: winnerId,
            guildId: raffle.guildId,
            amount: pot,
            raffleId: raffle.drawId,
            game: 'raffle'
          })
        }
      }

      const outcome: RaffleDrawOutcome = refunded
        ? 'refunded'
        : winnerId
          ? 'won'
          : 'no_participants'
      const drawSummary = calculateRaffleDrawSummary({
        participants,
        ticketPrice: raffle.ticketPrice,
        houseCutRate: houseCut,
        drawId: raffle.drawId,
        outcome,
        winnerId
      })
      const logsChannelId = guildConfig.raffleChannelIds?.logs
      if (logsChannelId) {
        await postRaffleDrawLog(client, {
          guildId: raffle.guildId,
          logsChannelId,
          summary: drawSummary,
          globalSettings: guildConfig.globalSettings
        })
      }

      const cycle = computeNextRaffleCycle(raffle)
      const outcomeContext = {
        raffle,
        guildConfig,
        refunded,
        winnerId,
        participants,
        pot
      }

      const channel = await client.channels
        .fetch(raffle.channelId)
        .catch(() => null)
      if (!channel?.isTextBased()) {
        await advanceRaffleSchedule(raffle, cycle)
        await postRaffleWorkerLog(client, {
          ...outcomeContext,
          discordIssue: 'channel'
        })
        await sleep(500)
        continue
      }

      const raffleMessage = await channel.messages
        .fetch(raffle.raffleId)
        .catch(() => null)
      if (!raffleMessage) {
        await advanceRaffleSchedule(raffle, cycle)
        await postRaffleWorkerLog(client, {
          ...outcomeContext,
          discordIssue: 'message'
        })
        await sleep(500)
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
        await advanceRaffleSchedule(raffle, cycle)
        await postRaffleWorkerLog(client, {
          ...outcomeContext,
          discordIssue: 'thread'
        })
        await sleep(500)
        continue
      }

      const resultEmbed = new EmbedBuilder()
        .setColor(
          refunded ? Colors.Orange : winnerId ? Colors.Gold : Colors.Red
        )
        .setTitle('🎉 Raffle Draw Result')
        .setDescription(
          refunded
            ? 'Not enough participants - all tickets refunded.'
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

      const nextDrawUnix = Math.floor(cycle.nextDrawAt.getTime() / 1000)

      const resetEmbed = new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle('🎫 Global Raffle')
        .setDescription(
          `💰 Ticket Price: **${formatMoneyExact(raffle.ticketPrice, guildConfig.globalSettings)}**\n🎟️ Ticket Limit: **${raffle.maxTicketsPerUser}**\n\n🗓️ Next Draw: **<t:${nextDrawUnix}:F>**\n\n💸 Current Pot: **${formatMoney(0, guildConfig.globalSettings)}**`
        )
        .setFooter({ text: `ID: ${cycle.drawId}` })
        .setTimestamp()

      await raffleMessage.edit({ embeds: [resetEmbed] })
      await advanceRaffleSchedule(raffle, cycle)
      await postRaffleWorkerLog(client, outcomeContext)

      await sleep(500)
    } catch (err) {
      logger.error(`[RAFFLE] Fatal error ${raffle.raffleId}`, err)
      await postWorkerLog(client, {
        guildId: raffle.guildId,
        worker: 'Raffles',
        title: 'Draw failed',
        description: `Raffle \`${raffle.raffleId}\` could not be drawn. Check server logs.`,
        level: 'error'
      }).catch(() => null)
    }
  }
}
