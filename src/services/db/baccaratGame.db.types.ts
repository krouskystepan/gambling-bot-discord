import type {
  BaccaratSessionPhase,
  TBaccaratPendingDeal
} from 'gambling-bot-shared/baccarat'
import { TUser } from 'gambling-bot-shared/user'

export type TGetBaccaratGame = Pick<TUser, 'userId' | 'guildId'>

export type TUpsertBaccaratGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId: string
  messageId: string
  betId: string
  betAmount: number
  showBalance: boolean
  skipAnimations: boolean
  phase?: BaccaratSessionPhase
  pendingDeal?: TBaccaratPendingDeal | null
}

export type TUpdateBaccaratGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId?: string
  messageId?: string
  betAmount?: number
  showBalance?: boolean
  skipAnimations?: boolean
  phase?: BaccaratSessionPhase
  pendingDeal?: TBaccaratPendingDeal | null
}
