import type { CasinoSessionStats } from 'gambling-bot-shared/casino'
import type { PlinkoSessionPhase } from 'gambling-bot-shared/plinko'
import { TUser } from 'gambling-bot-shared/user'

export type TGetPlinkoGame = Pick<TUser, 'userId' | 'guildId'>

export type TUpsertPlinkoGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId: string
  messageId: string
  gameId: string
  showBalance: boolean
  skipAnimations: boolean
  unitBet?: number | null
  ballsCount?: number
  phase?: PlinkoSessionPhase
  lastNetResult?: number | null
  lastBallsCount?: number | null
  lastTotalBet?: number | null
  lastWinsCount?: number | null
  pendingBatchResults?: number[][] | null
  activeBetId?: string | null
  lockedAmount?: number | null
  sessionStats?: CasinoSessionStats
}

export type TUpdatePlinkoGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId?: string
  messageId?: string
  showBalance?: boolean
  skipAnimations?: boolean
  unitBet?: number | null
  ballsCount?: number
  phase?: PlinkoSessionPhase
  lastNetResult?: number | null
  lastBallsCount?: number | null
  lastTotalBet?: number | null
  lastWinsCount?: number | null
  pendingBatchResults?: number[][] | null
  activeBetId?: string | null
  lockedAmount?: number | null
  sessionStats?: CasinoSessionStats
}
