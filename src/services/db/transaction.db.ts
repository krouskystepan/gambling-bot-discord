import Transaction from '../../models/Transaction'
import {
  TCreateMultipleTransactions,
  TCreateTransaction,
  TDeleteAllTransactions,
  TListUserTransactions
} from './transaction.db.types'

/** Staff audit rows are not financial ledger entries. */
export const EXCLUDE_STAFF_AUDIT_TRANSACTION_FILTER = {
  $or: [
    { 'meta.adminAction': { $exists: false } },
    { 'meta.adminAction': null }
  ]
} as const

export const createTransaction = async ({
  userId,
  guildId,
  amount,
  type,
  source,
  referenceId,
  meta,
  handledBy,
  createdAt = new Date()
}: TCreateTransaction) => {
  const transaction = await Transaction.create({
    userId,
    guildId,
    amount,
    type,
    source,
    referenceId,
    meta,
    handledBy,
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

export const listUserTransactions = async ({
  guildId,
  userId,
  types,
  limit = 15
}: TListUserTransactions) => {
  const filter: Record<string, unknown> = {
    guildId,
    userId,
    ...EXCLUDE_STAFF_AUDIT_TRANSACTION_FILTER
  }

  if (types?.length) {
    filter.type = { $in: types }
  }

  return Transaction.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
}
