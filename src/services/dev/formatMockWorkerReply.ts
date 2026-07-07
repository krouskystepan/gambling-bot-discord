import type { WorkerMockSummary } from './mockWorkerDb'

const DISCORD_CONTENT_LIMIT = 2000

const compactMockWorkerLines = (lines: string[]): string[] => {
  const result: string[] = []
  let section: string | null = null
  let itemCount = 0

  const flushSection = () => {
    if (!section) return
    result.push(`**${section}** — ${itemCount} item(s)`)
    section = null
    itemCount = 0
  }

  for (const line of lines) {
    if (line.startsWith('**') && line.endsWith('**')) {
      flushSection()
      section = line.slice(2, -2)
      continue
    }

    if (!line.trim()) {
      flushSection()
      continue
    }

    itemCount++
  }

  flushSection()
  return result
}

const chunkDiscordContent = (
  text: string,
  limit = DISCORD_CONTENT_LIMIT
): string[] => {
  const chunks: string[] = []
  let remaining = text

  while (remaining.length > limit) {
    let splitAt = remaining.lastIndexOf('\n', limit)
    if (splitAt <= 0) splitAt = limit
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  if (remaining) chunks.push(remaining)
  return chunks
}

export const formatMockWorkerReplyMessages = (
  summary: WorkerMockSummary,
  count?: number
): string[] => {
  const countLabel =
    count != null && summary.entity === 'all' ? `, ${count} each` : ''
  const header =
    `✅ Worker test data seeded (**${summary.entity}**${countLabel})\n` +
    `🧹 Clear with \`/clear-mock-db\` when finished\n\n`

  const body = summary.lines.join('\n')
  const full = header + body
  if (full.length <= DISCORD_CONTENT_LIMIT) {
    return [full]
  }

  const compact = header + compactMockWorkerLines(summary.lines).join('\n')
  if (compact.length <= DISCORD_CONTENT_LIMIT) {
    return [compact]
  }

  return chunkDiscordContent(compact)
}
