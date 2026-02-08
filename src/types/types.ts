import {
  TPrediction,
  TPredictionOption,
  TTransaction,
  TUser,
  TVipRoom
} from 'gambling-bot-shared'

import { EngineState } from '@/utils/casino/blackjack'

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
export type TCreatePrediction = Omit<TPrediction, 'createdAt' | 'updatedAt'>

// Read - Get
export type TGetUser = Pick<TUser, 'userId' | 'guildId'>
export type TGetVip = Pick<TVipRoom, 'guildId' | 'ownerId'>
export type TGetBlackjackGame = Pick<TUser, 'userId' | 'guildId'>
export type TGetRaffle = Pick<TUser, 'userId' | 'guildId'>
export type TGetGuildcongifuration = Pick<TUser, 'guildId'>
export type TGetPrediction = Pick<TPrediction, 'predictionId' | 'guildId'>
export type TGetOldPredictions = {
  statuses: TPrediction['status'][]
  olderThanDays: number
}

// Update
export type TUpdateUserBalance = Pick<TUser, 'userId' | 'guildId'> & {
  amount: number
  lockedAmount?: number
}
export type TUpdatePredictionStatus = Pick<
  TPrediction,
  'predictionId' | 'guildId'
> & {
  fromStatus: TPrediction['status'] | TPrediction['status'][]
  toStatus: TPrediction['status']
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

export type TAddPredictionBet = Pick<
  TPrediction,
  'predictionId' | 'guildId'
> & {
  choiceName: TPredictionOption['choiceName']
  userId: TPredictionOption['bets'][number]['userId']
  amount: TPredictionOption['bets'][number]['amount']
}
