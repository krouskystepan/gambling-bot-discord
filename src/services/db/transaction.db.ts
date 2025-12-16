import Transaction from '../../models/Transaction'
import {
  TCreateMultipleTransactions,
  TCreateTransaction,
  TDeleteAllTransactions
} from '../../types/types'

export const createTransaction = async ({
  userId,
  guildId,
  amount,
  type,
  source,
  betId,
  meta,
  createdAt = new Date()
}: TCreateTransaction) => {
  const transaction = await Transaction.create({
    userId,
    guildId,
    amount,
    type,
    source,
    betId,
    meta,
    createdAt
  })

  return transaction
}

export const createMultipleTransactions = async (
  transactions: TCreateMultipleTransactions
): Promise<void> => {
  await Transaction.insertMany(transactions)
}

export const deleteAllTransactionsByUserId = async ({
  userId,
  guildId
}: TDeleteAllTransactions) => {
  await Transaction.deleteMany({
    userId,
    guildId
  })
}
