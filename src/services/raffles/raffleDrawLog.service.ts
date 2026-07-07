import { formatMoneyExact } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'

import {
  EmbedBuilder,
  NewsChannel,
  TextChannel,
  ThreadChannel
} from 'discord.js'

import { Client } from 'commandkit'

import { isGuildSendableChannel } from '@/utils/discord/channelGuards'
import {
  createInfoEmbed,
  createSuccessEmbed,
  createWarningEmbed
} from '@/utils/discord/createEmbed'
import { logger } from '@/utils/logger'

const MAX_BREAKDOWN_CHARS = 1000

export type RaffleDrawOutcome = 'won' | 'refunded' | 'no_participants'

export type RaffleDrawSummary = {
  outcome: RaffleDrawOutcome
  drawId: string
  participantCount: number
  totalTickets: number
  ticketPrice: number
  grossPot: number
  houseCutRate: number
  houseCutAmount: number
  netPot: number
  winnerId: string | null
  participants: { userId: string; tickets: number; spent: number }[]
}

export type CalculateRaffleDrawSummaryParams = {
  participants: { userId: string; tickets: number }[]
  ticketPrice: number
  houseCutRate: number
  drawId: string
  outcome: RaffleDrawOutcome
  winnerId: string | null
}

export const calculateRaffleDrawSummary = ({
  participants,
  ticketPrice,
  houseCutRate,
  drawId,
  outcome,
  winnerId
}: CalculateRaffleDrawSummaryParams): RaffleDrawSummary => {
  const activeParticipants = participants.filter((p) => p.tickets > 0)
  const totalTickets = activeParticipants.reduce((s, p) => s + p.tickets, 0)
  const grossPot = totalTickets * ticketPrice
  const houseCutAmount = grossPot * houseCutRate
  const netPot = grossPot - houseCutAmount

  const sortedParticipants = activeParticipants
    .map((p) => ({
      userId: p.userId,
      tickets: p.tickets,
      spent: p.tickets * ticketPrice
    }))
    .sort((a, b) => b.tickets - a.tickets)

  return {
    outcome,
    drawId,
    participantCount: activeParticipants.length,
    totalTickets,
    ticketPrice,
    grossPot,
    houseCutRate,
    houseCutAmount,
    netPot,
    winnerId,
    participants: sortedParticipants
  }
}

export type PostRaffleDrawLogParams = {
  guildId: string
  logsChannelId: string
  summary: RaffleDrawSummary
  globalSettings: Partial<GlobalSettings> | null | undefined
}

const formatHouseCutRate = (rate: number): string => {
  const percent = rate * 100
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`
}

export const formatParticipantBreakdown = (
  participants: RaffleDrawSummary['participants'],
  globalSettings: Partial<GlobalSettings> | null | undefined
): string => {
  if (!participants.length) return 'None'

  const lines: string[] = []
  let length = 0

  for (const [index, participant] of participants.entries()) {
    const line = `<@${participant.userId}> (${participant.tickets} tickets, ${formatMoneyExact(participant.spent, globalSettings)})`
    const nextLength = length + (index > 0 ? 1 : 0) + line.length

    if (nextLength > MAX_BREAKDOWN_CHARS && lines.length > 0) {
      const remaining = participants.length - lines.length
      return `${lines.join('\n')}\n…and ${remaining} more`
    }

    lines.push(line)
    length = nextLength
  }

  return lines.join('\n')
}

const buildWinEmbed = (
  summary: RaffleDrawSummary,
  globalSettings: Partial<GlobalSettings> | null | undefined
): EmbedBuilder => {
  const description = `Draw \`${summary.drawId}\` completed with a winner.`

  return createSuccessEmbed('Raffle draw — winner', description, summary.drawId)
    .addFields(
      {
        name: 'Participants',
        value: `${summary.participantCount} unique user(s)`,
        inline: true
      },
      {
        name: 'Total tickets',
        value: String(summary.totalTickets),
        inline: true
      },
      {
        name: 'Ticket price',
        value: formatMoneyExact(summary.ticketPrice, globalSettings),
        inline: true
      },
      {
        name: 'Gross pot',
        value: formatMoneyExact(summary.grossPot, globalSettings),
        inline: true
      },
      {
        name: 'House cut',
        value: `${formatHouseCutRate(summary.houseCutRate)} (${formatMoneyExact(summary.houseCutAmount, globalSettings)} kept)`,
        inline: true
      },
      {
        name: 'Net paid',
        value: formatMoneyExact(summary.netPot, globalSettings),
        inline: true
      },
      {
        name: 'Winner',
        value: summary.winnerId ? `<@${summary.winnerId}>` : 'Unknown',
        inline: false
      },
      {
        name: 'Ticket breakdown',
        value: formatParticipantBreakdown(summary.participants, globalSettings),
        inline: false
      }
    )
    .setTimestamp()
}

const buildRefundEmbed = (
  summary: RaffleDrawSummary,
  globalSettings: Partial<GlobalSettings> | null | undefined
): EmbedBuilder => {
  const refundedUser = summary.participants[0]
  const totalRefunded = summary.participants.reduce(
    (sum, p) => sum + p.spent,
    0
  )
  const description = `Draw \`${summary.drawId}\` refunded — not enough participants.`

  return createWarningEmbed(
    'Raffle draw — refunded',
    description,
    summary.drawId
  )
    .addFields(
      {
        name: 'Participants',
        value: String(summary.participantCount),
        inline: true
      },
      {
        name: 'Total refunded',
        value: formatMoneyExact(totalRefunded, globalSettings),
        inline: true
      },
      {
        name: 'Refunded',
        value: refundedUser
          ? `<@${refundedUser.userId}> — ${formatMoneyExact(refundedUser.spent, globalSettings)}`
          : 'Unknown',
        inline: false
      }
    )
    .setTimestamp()
}

const buildNoParticipantsEmbed = (summary: RaffleDrawSummary): EmbedBuilder => {
  return createInfoEmbed(
    'Raffle draw — no sales',
    `Draw \`${summary.drawId}\` finished with zero ticket sales this round.`
  )
    .setFooter({ text: `ID: ${summary.drawId}` })
    .setTimestamp()
}

export const buildRaffleDrawLogEmbed = (
  summary: RaffleDrawSummary,
  globalSettings: Partial<GlobalSettings> | null | undefined
): EmbedBuilder => {
  switch (summary.outcome) {
    case 'won':
      return buildWinEmbed(summary, globalSettings)
    case 'refunded':
      return buildRefundEmbed(summary, globalSettings)
    case 'no_participants':
      return buildNoParticipantsEmbed(summary)
  }
}

export const postRaffleDrawLog = async (
  client: Client<true>,
  { guildId, logsChannelId, summary, globalSettings }: PostRaffleDrawLogParams
): Promise<void> => {
  const guild = await client.guilds.fetch(guildId).catch(() => null)
  if (!guild) return

  const rawChannel = await guild.channels.fetch(logsChannelId).catch(() => null)
  if (!isGuildSendableChannel(rawChannel)) {
    logger.error(
      { channelId: logsChannelId, guildId, drawId: summary.drawId },
      'Raffle logs channel not sendable'
    )
    return
  }

  const embed = buildRaffleDrawLogEmbed(summary, globalSettings)

  const sendableChannel = rawChannel as
    | TextChannel
    | NewsChannel
    | ThreadChannel
  sendableChannel.send({ embeds: [embed] }).catch((err: unknown) => {
    logger.error(
      { err, guildId, channelId: logsChannelId, drawId: summary.drawId },
      'Failed to send raffle draw log'
    )
  })
}
