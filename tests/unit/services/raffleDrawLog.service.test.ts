import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Colors } from 'discord.js'

import {
  type RaffleDrawSummary,
  buildRaffleDrawLogEmbed,
  calculateRaffleDrawSummary,
  formatParticipantBreakdown,
  postRaffleDrawLog
} from '@/services/raffles/raffleDrawLog.service'

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn() }
}))

const { logger } = await import('@/utils/logger')

const globalSettings = {
  currencySymbol: '$',
  locale: 'en-US'
} as const

const winSummary: RaffleDrawSummary = {
  outcome: 'won',
  drawId: 'draw-1',
  participantCount: 2,
  totalTickets: 8,
  ticketPrice: 10,
  grossPot: 80,
  houseCutRate: 0.1,
  houseCutAmount: 8,
  netPot: 72,
  winnerId: 'winner-1',
  participants: [
    { userId: 'winner-1', tickets: 5, spent: 50 },
    { userId: 'user-2', tickets: 3, spent: 30 }
  ]
}

const refundSummary: RaffleDrawSummary = {
  outcome: 'refunded',
  drawId: 'draw-2',
  participantCount: 1,
  totalTickets: 4,
  ticketPrice: 10,
  grossPot: 40,
  houseCutRate: 0.1,
  houseCutAmount: 4,
  netPot: 36,
  winnerId: null,
  participants: [{ userId: 'solo', tickets: 4, spent: 40 }]
}

const noParticipantsSummary: RaffleDrawSummary = {
  outcome: 'no_participants',
  drawId: 'draw-3',
  participantCount: 0,
  totalTickets: 0,
  ticketPrice: 10,
  grossPot: 0,
  houseCutRate: 0.1,
  houseCutAmount: 0,
  netPot: 0,
  winnerId: null,
  participants: []
}

const getFieldValue = (
  embed: ReturnType<typeof buildRaffleDrawLogEmbed>,
  name: string
) => embed.data.fields?.find((field) => field.name === name)?.value

describe('calculateRaffleDrawSummary', () => {
  it('summarizes a winning draw with house cut and sorts by tickets', () => {
    const summary = calculateRaffleDrawSummary({
      participants: [
        { userId: 'user-2', tickets: 3 },
        { userId: 'user-1', tickets: 5 },
        { userId: 'user-3', tickets: 2 }
      ],
      ticketPrice: 10,
      houseCutRate: 0.1,
      drawId: 'draw-1',
      outcome: 'won',
      winnerId: 'user-1'
    })

    expect(summary).toEqual({
      outcome: 'won',
      drawId: 'draw-1',
      participantCount: 3,
      totalTickets: 10,
      ticketPrice: 10,
      grossPot: 100,
      houseCutRate: 0.1,
      houseCutAmount: 10,
      netPot: 90,
      winnerId: 'user-1',
      participants: [
        { userId: 'user-1', tickets: 5, spent: 50 },
        { userId: 'user-2', tickets: 3, spent: 30 },
        { userId: 'user-3', tickets: 2, spent: 20 }
      ]
    })
  })

  it('summarizes a refund for a single participant', () => {
    const summary = calculateRaffleDrawSummary({
      participants: [{ userId: 'solo', tickets: 4 }],
      ticketPrice: 25,
      houseCutRate: 0.1,
      drawId: 'draw-2',
      outcome: 'refunded',
      winnerId: null
    })

    expect(summary.outcome).toBe('refunded')
    expect(summary.participantCount).toBe(1)
    expect(summary.grossPot).toBe(100)
    expect(summary.netPot).toBe(90)
    expect(summary.participants).toEqual([
      { userId: 'solo', tickets: 4, spent: 100 }
    ])
  })

  it('summarizes a round with no participants', () => {
    const summary = calculateRaffleDrawSummary({
      participants: [],
      ticketPrice: 10,
      houseCutRate: 0.1,
      drawId: 'draw-3',
      outcome: 'no_participants',
      winnerId: null
    })

    expect(summary.participantCount).toBe(0)
    expect(summary.totalTickets).toBe(0)
    expect(summary.grossPot).toBe(0)
    expect(summary.houseCutAmount).toBe(0)
    expect(summary.netPot).toBe(0)
    expect(summary.participants).toEqual([])
  })

  it('ignores zero-ticket participants and handles zero house cut', () => {
    const summary = calculateRaffleDrawSummary({
      participants: [
        { userId: 'user-1', tickets: 0 },
        { userId: 'user-2', tickets: 2 }
      ],
      ticketPrice: 50,
      houseCutRate: 0,
      drawId: 'draw-4',
      outcome: 'won',
      winnerId: 'user-2'
    })

    expect(summary.participantCount).toBe(1)
    expect(summary.totalTickets).toBe(2)
    expect(summary.grossPot).toBe(100)
    expect(summary.houseCutAmount).toBe(0)
    expect(summary.netPot).toBe(100)
    expect(summary.participants).toEqual([
      { userId: 'user-2', tickets: 2, spent: 100 }
    ])
  })
})

describe('buildRaffleDrawLogEmbed', () => {
  it('builds win embed fields with staff detail', () => {
    const embed = buildRaffleDrawLogEmbed(winSummary, globalSettings)

    expect(embed.data.title).toBe('Raffle draw — winner')
    expect(embed.data.color).toBe(Colors.Green)
    expect(getFieldValue(embed, 'Participants')).toBe('2 unique user(s)')
    expect(getFieldValue(embed, 'Total tickets')).toBe('8')
    expect(getFieldValue(embed, 'Ticket price')).toBe('$10')
    expect(getFieldValue(embed, 'Gross pot')).toBe('$80')
    expect(getFieldValue(embed, 'House cut')).toBe('10% ($8 kept)')
    expect(getFieldValue(embed, 'Net paid')).toBe('$72')
    expect(getFieldValue(embed, 'Winner')).toBe('<@winner-1>')
    expect(getFieldValue(embed, 'Ticket breakdown')).toContain(
      '<@winner-1> (5 tickets, $50)'
    )
  })

  it('builds refund embed fields', () => {
    const embed = buildRaffleDrawLogEmbed(refundSummary, globalSettings)

    expect(embed.data.title).toBe('Raffle draw — refunded')
    expect(embed.data.color).toBe(Colors.Yellow)
    expect(getFieldValue(embed, 'Participants')).toBe('1')
    expect(getFieldValue(embed, 'Total refunded')).toBe('$40')
    expect(getFieldValue(embed, 'Refunded')).toBe('<@solo> — $40')
  })

  it('falls back to Unknown winner and refund when participants are empty', () => {
    const winEmbed = buildRaffleDrawLogEmbed(
      { ...winSummary, winnerId: null },
      globalSettings
    )
    expect(getFieldValue(winEmbed, 'Winner')).toBe('Unknown')

    const refundEmbed = buildRaffleDrawLogEmbed(
      { ...refundSummary, participants: [] },
      globalSettings
    )
    expect(getFieldValue(refundEmbed, 'Refunded')).toBe('Unknown')
  })

  it('formats a fractional house cut rate', () => {
    const embed = buildRaffleDrawLogEmbed(
      { ...winSummary, houseCutRate: 0.075, houseCutAmount: 6 },
      globalSettings
    )
    expect(getFieldValue(embed, 'House cut')).toBe('7.50% ($6 kept)')
  })

  it('builds a minimal no-participants embed', () => {
    const embed = buildRaffleDrawLogEmbed(noParticipantsSummary, globalSettings)

    expect(embed.data.title).toBe('Raffle draw — no sales')
    expect(embed.data.color).toBe(Colors.Blue)
    expect(embed.data.footer?.text).toBe('ID: draw-3')
    expect(embed.data.fields ?? []).toHaveLength(0)
  })
})

describe('formatParticipantBreakdown empty', () => {
  it('returns None when there are no participants', () => {
    expect(formatParticipantBreakdown([], globalSettings)).toBe('None')
  })
})

describe('formatParticipantBreakdown', () => {
  it('truncates long participant lists', () => {
    const participants = Array.from({ length: 80 }, (_, index) => ({
      userId: `user-${index}`,
      tickets: 10,
      spent: 100
    }))

    const breakdown = formatParticipantBreakdown(participants, globalSettings)

    expect(breakdown.length).toBeLessThanOrEqual(1024)
    expect(breakdown).toMatch(/…and \d+ more$/)
    expect(breakdown).toContain('<@user-0> (10 tickets, $100)')
  })
})

describe('postRaffleDrawLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('skips when guild is missing', async () => {
    const client = {
      guilds: { fetch: vi.fn().mockResolvedValue(null) }
    }

    await postRaffleDrawLog(client as never, {
      guildId: 'guild-1',
      logsChannelId: 'logs-ch',
      summary: winSummary,
      globalSettings
    })

    expect(logger.error).not.toHaveBeenCalled()
  })

  it('skips when guild fetch fails', async () => {
    const client = {
      guilds: { fetch: vi.fn().mockRejectedValue(new Error('nope')) }
    }

    await postRaffleDrawLog(client as never, {
      guildId: 'guild-1',
      logsChannelId: 'logs-ch',
      summary: winSummary,
      globalSettings
    })

    expect(client.guilds.fetch).toHaveBeenCalledWith('guild-1')
  })

  it('logs not sendable when channel fetch fails', async () => {
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          id: 'guild-1',
          channels: {
            fetch: vi.fn().mockRejectedValue(new Error('missing channel'))
          }
        })
      }
    }

    await postRaffleDrawLog(client as never, {
      guildId: 'guild-1',
      logsChannelId: 'logs-ch',
      summary: winSummary,
      globalSettings
    })

    expect(logger.error).toHaveBeenCalledWith(
      { channelId: 'logs-ch', guildId: 'guild-1', drawId: 'draw-1' },
      'Raffle logs channel not sendable'
    )
  })

  it('skips when channel is not sendable', async () => {
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          id: 'guild-1',
          channels: {
            fetch: vi.fn().mockResolvedValue({ guild: { id: 'guild-1' } })
          }
        })
      }
    }

    await postRaffleDrawLog(client as never, {
      guildId: 'guild-1',
      logsChannelId: 'logs-ch',
      summary: winSummary,
      globalSettings
    })

    expect(logger.error).toHaveBeenCalledWith(
      { channelId: 'logs-ch', guildId: 'guild-1', drawId: 'draw-1' },
      'Raffle logs channel not sendable'
    )
  })

  it('sends embed when channel is configured and sendable', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          id: 'guild-1',
          channels: {
            fetch: vi.fn().mockResolvedValue({
              send,
              guild: { id: 'guild-1' }
            })
          }
        })
      }
    }

    await postRaffleDrawLog(client as never, {
      guildId: 'guild-1',
      logsChannelId: 'logs-ch',
      summary: winSummary,
      globalSettings
    })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].embeds).toHaveLength(1)
    expect(send.mock.calls[0][0].embeds[0].data.title).toBe(
      'Raffle draw — winner'
    )
  })

  it('logs when send fails', async () => {
    const sendError = new Error('send failed')
    const send = vi.fn().mockRejectedValue(sendError)
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          id: 'guild-1',
          channels: {
            fetch: vi.fn().mockResolvedValue({
              send,
              guild: { id: 'guild-1' }
            })
          }
        })
      }
    }

    await postRaffleDrawLog(client as never, {
      guildId: 'guild-1',
      logsChannelId: 'logs-ch',
      summary: winSummary,
      globalSettings
    })

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        {
          err: sendError,
          guildId: 'guild-1',
          channelId: 'logs-ch',
          drawId: 'draw-1'
        },
        'Failed to send raffle draw log'
      )
    })
  })
})
