import { TUser } from 'gambling-bot-shared/user'

import { EngineState } from '@/utils/casino/blackjack'

export type TGetBlackjackGame = Pick<TUser, 'userId' | 'guildId'>

export type TUpsertBlackjackGame = Pick<TUser, 'userId' | 'guildId'> &
  EngineState & {
    channelId: string
    messageId: string
    betId: string
  }
