import type { TBlackjackGame } from 'gambling-bot-shared/blackjack'
import type { CasinoSessionStats } from 'gambling-bot-shared/casino'
import { TUser } from 'gambling-bot-shared/user'

import { EngineState } from '@/utils/casino/blackjack'

export type TGetBlackjackGame = Pick<TUser, 'userId' | 'guildId'>

export type TUpsertBlackjackGame = Pick<TUser, 'userId' | 'guildId'> &
  EngineState & {
    channelId: string
    messageId: string
    gameId: string
    activeBetId?: string | null
    baseBetAmount: number
    showBalance: boolean
    skipAnimations?: boolean
    sessionStats?: CasinoSessionStats
  }

export type TUpdateBlackjackGame = Pick<TUser, 'userId' | 'guildId'> &
  Partial<EngineState> &
  Partial<
    Pick<
      TBlackjackGame,
      | 'channelId'
      | 'messageId'
      | 'activeBetId'
      | 'baseBetAmount'
      | 'showBalance'
      | 'skipAnimations'
      | 'sessionStats'
    >
  >
