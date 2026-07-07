import { Client } from 'commandkit'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatGuildCountBreakdown,
  formatGuildDetailBreakdown,
  logMultiGuildCountSummary,
  resolveGuildLabel
} from '@/utils/worker/multiGuildWorkerLog'

vi.mock('@/utils/logger', () => ({
  logger: { worker: vi.fn() }
}))

const { logger } = await import('@/utils/logger')

const createClient = (guilds: Record<string, string>): Client<true> =>
  ({
    guilds: {
      cache: new Map(
        Object.entries(guilds).map(([id, name]) => [id, { id, name }])
      )
    }
  }) as unknown as Client<true>

describe('multiGuildWorkerLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resolveGuildLabel', () => {
    it('returns guild name and id when cached', () => {
      const client = createClient({ 'guild-1': 'My Server' })

      expect(resolveGuildLabel(client, 'guild-1')).toBe('My Server (guild-1)')
    })

    it('falls back to guild id when not cached', () => {
      const client = createClient({})

      expect(resolveGuildLabel(client, 'guild-missing')).toBe('guild-missing')
    })
  })

  describe('formatGuildCountBreakdown', () => {
    it('formats a single guild', () => {
      const client = createClient({ 'guild-1': 'Server A' })
      const counts = new Map([['guild-1', 3]])

      expect(formatGuildCountBreakdown(client, counts, 'room(s)')).toBe(
        'Server A (guild-1) (3 room(s))'
      )
    })

    it('formats multiple guilds sorted by count descending', () => {
      const client = createClient({
        'guild-1': 'Server A',
        'guild-2': 'Server B'
      })
      const counts = new Map([
        ['guild-1', 2],
        ['guild-2', 5]
      ])

      expect(formatGuildCountBreakdown(client, counts, 'nudge(s)')).toBe(
        'Server B (guild-2) (5 nudge(s)), Server A (guild-1) (2 nudge(s))'
      )
    })

    it('truncates after five guilds', () => {
      const client = createClient({
        'guild-1': 'G1',
        'guild-2': 'G2',
        'guild-3': 'G3',
        'guild-4': 'G4',
        'guild-5': 'G5',
        'guild-6': 'G6'
      })
      const counts = new Map([
        ['guild-1', 1],
        ['guild-2', 2],
        ['guild-3', 3],
        ['guild-4', 4],
        ['guild-5', 5],
        ['guild-6', 6]
      ])

      const breakdown = formatGuildCountBreakdown(client, counts, 'game(s)')

      expect(breakdown).toContain('+1 more')
      expect(breakdown.match(/\(guild-/g)).toHaveLength(5)
    })
  })

  describe('formatGuildDetailBreakdown', () => {
    it('formats per-guild detail strings', () => {
      const client = createClient({
        'guild-1': 'Server A',
        'guild-2': 'Server B'
      })
      const entries = new Map([
        ['guild-1', { sent24h: 2, sent1h: 1 }],
        ['guild-2', { sent24h: 1, sent1h: 0 }]
      ])

      expect(
        formatGuildDetailBreakdown(
          client,
          entries,
          (summary) => `24h: ${summary.sent24h}, 1h: ${summary.sent1h}`
        )
      ).toBe(
        'Server A (guild-1) (24h: 2, 1h: 1), Server B (guild-2) (24h: 1, 1h: 0)'
      )
    })
  })

  describe('logMultiGuildCountSummary', () => {
    it('passes structured guild context to logger.worker', () => {
      const client = createClient({
        'guild-1': 'Server A',
        'guild-2': 'Server B'
      })
      const guildCounts = new Map([
        ['guild-1', 3],
        ['guild-2', 2]
      ])

      logMultiGuildCountSummary({
        client,
        job: 'VIP expiration',
        verb: 'processed',
        total: 5,
        unit: 'room(s)',
        guildCounts
      })

      expect(logger.worker).toHaveBeenCalledWith(
        {
          guilds: { 'guild-1': 3, 'guild-2': 2 },
          guildCount: 2
        },
        'VIP expiration: processed 5 room(s) across 2 guild(s) — Server A (guild-1) (3 room(s)), Server B (guild-2) (2 room(s))'
      )
    })
  })
})
