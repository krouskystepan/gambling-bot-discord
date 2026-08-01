import type { CasinoSessionStats } from 'gambling-bot-shared/casino'
import { formatMoney } from 'gambling-bot-shared/common'
import type { GlobalSettings } from 'gambling-bot-shared/guild'

import { createBetEmbed } from '@/utils/discord/createEmbed'

type MoneySettings = Partial<GlobalSettings> | null | undefined

export type SessionCloseReason = 'closed' | 'timeout'

/**
 * Shared close / timeout embed for durable casino sessions so every game
 * reports the same cumulative numbers.
 */
export const formatSessionSummaryEmbed = ({
  gameLabel,
  emoji = '🎲',
  stats,
  reason,
  gameId,
  globalSettings,
  roundsLabel = 'Rounds'
}: {
  gameLabel: string
  emoji?: string
  stats: CasinoSessionStats
  reason: SessionCloseReason
  gameId?: string
  globalSettings?: MoneySettings
  /** What a counted unit means for this game (Hands, Spins, Boards, …). */
  roundsLabel?: string
}) => {
  const netEmoji =
    stats.netProfit > 0 ? '🟢' : stats.netProfit < 0 ? '🔴' : '🟡'

  const lines = [
    `🎲 ${roundsLabel}: **${stats.roundsPlayed}**`,
    `💵 Wagered: **${formatMoney(stats.totalWagered, globalSettings)}**`,
    `💰 Payout: **${formatMoney(stats.totalPayout, globalSettings)}**`,
    `📊 Net: ${netEmoji} **${formatMoney(stats.netProfit, globalSettings)}**`,
    reason === 'timeout'
      ? '_This session was closed after being idle too long._'
      : '_This session was closed._'
  ]

  return createBetEmbed(
    `${emoji} ${gameLabel} ${reason === 'timeout' ? 'Timed Out' : 'Closed'}`,
    'Grey',
    lines.join('\n\n'),
    gameId
  )
}
