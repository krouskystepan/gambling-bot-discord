import type {
  BaccaratSessionPhase,
  TBaccaratPendingDeal
} from 'gambling-bot-shared/baccarat'
import type {
  BaccaratSlipBet,
  CasinoSessionStats
} from 'gambling-bot-shared/casino'
import { TUser } from 'gambling-bot-shared/user'

export type TGetBaccaratGame = Pick<TUser, 'userId' | 'guildId'>

export type TUpsertBaccaratGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId: string
  messageId: string
  gameId: string
  activeBetId?: string | null
  bets?: BaccaratSlipBet[]
  lastBets?: BaccaratSlipBet[]
  lockedAmount?: number | null
  showBalance: boolean
  skipAnimations: boolean
  phase?: BaccaratSessionPhase
  pendingDeal?: TBaccaratPendingDeal | null
  sessionStats?: CasinoSessionStats
}

export type TUpdateBaccaratGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId?: string
  messageId?: string
  activeBetId?: string | null
  bets?: BaccaratSlipBet[]
  lastBets?: BaccaratSlipBet[]
  lockedAmount?: number | null
  showBalance?: boolean
  skipAnimations?: boolean
  phase?: BaccaratSessionPhase
  pendingDeal?: TBaccaratPendingDeal | null
  sessionStats?: CasinoSessionStats
}
