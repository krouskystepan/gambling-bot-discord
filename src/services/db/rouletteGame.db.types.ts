import type {
  RouletteSessionPhase,
  TRouletteSlipBet
} from 'gambling-bot-shared/roulette'
import { TUser } from 'gambling-bot-shared/user'

export type TGetRouletteGame = Pick<TUser, 'userId' | 'guildId'>

export type TUpsertRouletteGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId: string
  messageId: string
  gameId: string
  showBalance: boolean
  skipAnimations: boolean
  phase?: RouletteSessionPhase
  bets?: TRouletteSlipBet[]
  lastBets?: TRouletteSlipBet[]
  lastSpinResult?: string | null
  pendingSpinResult?: string | null
  lastNetResult?: number | null
  activeBetId?: string | null
  lockedAmount?: number | null
}

export type TUpdateRouletteGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId?: string
  messageId?: string
  showBalance?: boolean
  skipAnimations?: boolean
  phase?: RouletteSessionPhase
  bets?: TRouletteSlipBet[]
  lastBets?: TRouletteSlipBet[]
  lastSpinResult?: string | null
  pendingSpinResult?: string | null
  lastNetResult?: number | null
  activeBetId?: string | null
  lockedAmount?: number | null
}
