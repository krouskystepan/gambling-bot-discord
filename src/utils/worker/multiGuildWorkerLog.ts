import { Client } from 'commandkit'

import { logger } from '@/utils/logger'

const MAX_INLINE_GUILDS = 5

export const resolveGuildLabel = (
  client: Client<true>,
  guildId: string
): string => {
  const guild = client.guilds?.cache?.get(guildId)
  return guild ? `${guild.name} (${guildId})` : guildId
}

const formatInlineGuildList = (
  parts: string[],
  totalGuilds: number
): string => {
  if (totalGuilds > MAX_INLINE_GUILDS) {
    parts.push(`+${totalGuilds - MAX_INLINE_GUILDS} more`)
  }
  return parts.join(', ')
}

export const formatGuildCountBreakdown = (
  client: Client<true>,
  counts: Map<string, number>,
  unit: string
): string => {
  const entries = [...counts.entries()].sort(([, a], [, b]) => b - a)
  const parts = entries
    .slice(0, MAX_INLINE_GUILDS)
    .map(
      ([guildId, count]) =>
        `${resolveGuildLabel(client, guildId)} (${count} ${unit})`
    )

  return formatInlineGuildList(parts, entries.length)
}

export const formatGuildDetailBreakdown = <T>(
  client: Client<true>,
  entries: Map<string, T>,
  formatDetail: (detail: T) => string
): string => {
  const list = [...entries.entries()]
  const parts = list
    .slice(0, MAX_INLINE_GUILDS)
    .map(
      ([guildId, detail]) =>
        `${resolveGuildLabel(client, guildId)} (${formatDetail(detail)})`
    )

  return formatInlineGuildList(parts, list.length)
}

export type LogMultiGuildCountSummaryParams = {
  client: Client<true>
  job: string
  verb: string
  total: number
  unit: string
  guildCounts: Map<string, number>
}

export const logMultiGuildCountSummary = ({
  client,
  job,
  verb,
  total,
  unit,
  guildCounts
}: LogMultiGuildCountSummaryParams): void => {
  const guildCount = guildCounts.size
  const breakdown = formatGuildCountBreakdown(client, guildCounts, unit)
  const message = `${job}: ${verb} ${total} ${unit} across ${guildCount} guild(s) — ${breakdown}`

  logger.worker(
    {
      guilds: Object.fromEntries(guildCounts),
      guildCount
    },
    message
  )
}
