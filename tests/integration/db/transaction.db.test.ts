import { describe, expect, it } from 'vitest'

import {
  createMultipleTransactions,
  createTransaction,
  deleteAllTransactionsByUserId
} from '@/services/db/transaction.db'

import { Transaction, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

describe('transaction.db', () => {
  it('creates multiple transactions', async () => {
    const now = new Date()
    await createMultipleTransactions([
      {
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 10,
        type: 'deposit',
        source: 'manual',
        createdAt: now
      },
      {
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 20,
        type: 'deposit',
        source: 'manual',
        createdAt: now
      }
    ])

    expect(await Transaction.countDocuments({ userId: 'user-1' })).toBe(2)
  })

  it('deletes all transactions for user in guild', async () => {
    await createTransaction({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 5,
      type: 'deposit',
      source: 'manual'
    })
    await createTransaction({
      userId: 'user-1',
      guildId: 'guild-1',
      amount: 15,
      type: 'bet',
      source: 'casino',
      betId: 'tx-del'
    })

    await deleteAllTransactionsByUserId({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(await Transaction.countDocuments({ userId: 'user-1' })).toBe(0)
  })
})
