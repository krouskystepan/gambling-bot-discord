import { TTransaction } from 'gambling-bot-shared/transactions'
import { TUser } from 'gambling-bot-shared/user'
import { TVipRoom } from 'gambling-bot-shared/vip'

import { EngineState } from '@/utils/casino/blackjack'

export type {
  TAddPredictionBet,
  TCreatePrediction,
  TGetOldPredictions,
  TGetPrediction,
  TUpdatePredictionStatus
} from 'gambling-bot-shared/predictions'

// Create
export type TCreateUser = Pick<TUser, 'userId' | 'guildId'>
export type TCreateVip = Pick<
  TVipRoom,
  'ownerId' | 'guildId' | 'channelId' | 'expiresAt'
>
export type TCreateTransaction = Omit<TTransaction, 'createdAt'> & {
  createdAt?: Date
}
export type TCreateMultipleTransactions = TTransaction[]

// Read - Get
export type TGetUser = Pick<TUser, 'userId' | 'guildId'>
export type TGetVip = Pick<TVipRoom, 'guildId' | 'ownerId'>
export type TGetBlackjackGame = Pick<TUser, 'userId' | 'guildId'>
export type TGetGuildcongifuration = Pick<TUser, 'guildId'>

// Update
export type TUpdateUserBalance = Pick<TUser, 'userId' | 'guildId'> & {
  amount: number
  lockedAmount?: number
}

// Delete
export type TDeleteAllTransactions = Pick<TUser, 'userId' | 'guildId'>

// Other
export type TUpsertBlackjackGame = Pick<TUser, 'userId' | 'guildId'> &
  EngineState & {
    channelId: string
    messageId: string
    betId: string
  }

export type TAddRaffleTickets = {
  raffleId: string
  guildId: string
  userId: string
  tickets: number
  maxTicketsPerUser: number
}
