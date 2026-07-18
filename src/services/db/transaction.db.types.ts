import { TTransaction } from 'gambling-bot-shared/transactions'
import { TUser } from 'gambling-bot-shared/user'

export type TCreateTransaction = Omit<TTransaction, 'createdAt'> & {
  createdAt?: Date
}
export type TCreateMultipleTransactions = TTransaction[]
export type TDeleteAllTransactions = Pick<TUser, 'userId' | 'guildId'>
