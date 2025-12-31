import {
  TPrediction,
  TPredictionOption,
  TTransaction,
  TUser,
  TVipRoom
} from 'gambling-bot-shared'

import { Card } from '@/utils/casino/blackjack'

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
export type TUpsertBlackjackGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId: string
  messageId: string
  betId: string
  betAmount: number
  deck: Card[]
  deckIndex: number
  playerCards: Card[]
  dealerCards: Card[]
}

export type TWithdrawResult =
  | {
      ok: true
      user: TUser
    }
  | {
      ok: false
      reason: 'INSUFFICIENT_BALANCE'
      balance: TUser['balance']
    }
  | {
      ok: false
      reason: 'INSUFFICIENT_WITHDRAWABLE'
      withdrawable: number
      locked: TUser['balance']
    }
export type TWithdrawBalance = Pick<TUser, 'userId' | 'guildId'> & {
  amount: number
}
export type TConsumeUserBalance = Pick<TUser, 'userId' | 'guildId'> & {
  amount: number
}
export type TAddPredictionBet = Pick<
  TPrediction,
  'predictionId' | 'guildId'
> & {
  choiceName: TPredictionOption['choiceName']
  userId: TPredictionOption['bets'][number]['userId']
  amount: TPredictionOption['bets'][number]['amount']
}
