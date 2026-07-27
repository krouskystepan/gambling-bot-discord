import type { SlotsSessionPhase } from 'gambling-bot-shared/slots'
import { TUser } from 'gambling-bot-shared/user'

export type TGetSlotsGame = Pick<TUser, 'userId' | 'guildId'>

export type TUpsertSlotsGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId: string
  messageId: string
  gameId: string
  showBalance: boolean
  skipAnimations: boolean
  unitBet?: number | null
  spinsCount?: number
  phase?: SlotsSessionPhase
  lastReels?: string | null
  lastNetResult?: number | null
  lastSpinsCount?: number | null
  lastTotalBet?: number | null
  lastWinsCount?: number | null
  pendingBatchResults?: string[] | null
  activeBetId?: string | null
  lockedAmount?: number | null
}

export type TUpdateSlotsGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId?: string
  messageId?: string
  showBalance?: boolean
  skipAnimations?: boolean
  unitBet?: number | null
  spinsCount?: number
  phase?: SlotsSessionPhase
  lastReels?: string | null
  lastNetResult?: number | null
  lastSpinsCount?: number | null
  lastTotalBet?: number | null
  lastWinsCount?: number | null
  pendingBatchResults?: string[] | null
  activeBetId?: string | null
  lockedAmount?: number | null
}
