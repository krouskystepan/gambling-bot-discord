import { describe, expect, it } from 'vitest'

import {
  createMultipleTransactions,
  createTransaction,
  deleteAllTransactionsByUserId,
  listUserTransactions
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
      referenceId: 'tx-del'
    })

    await deleteAllTransactionsByUserId({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(await Transaction.countDocuments({ userId: 'user-1' })).toBe(0)
  })

  it('lists recent transactions excluding staff-audit and respecting type/limit', async () => {
    const base = {
      userId: 'user-1',
      guildId: 'guild-1',
      source: 'manual' as const
    }

    await createTransaction({
      ...base,
      amount: 1,
      type: 'deposit',
      createdAt: new Date('2024-01-01T00:00:00.000Z')
    })
    await createTransaction({
      ...base,
      amount: 2,
      type: 'bet',
      source: 'casino',
      createdAt: new Date('2024-01-02T00:00:00.000Z')
    })
    await createTransaction({
      ...base,
      amount: 3,
      type: 'win',
      source: 'casino',
      createdAt: new Date('2024-01-03T00:00:00.000Z')
    })
    await createTransaction({
      ...base,
      amount: 0,
      type: 'bonus',
      meta: { adminAction: 'user-ban' },
      createdAt: new Date('2024-01-04T00:00:00.000Z')
    })
    await createTransaction({
      userId: 'user-2',
      guildId: 'guild-1',
      amount: 99,
      type: 'deposit',
      source: 'manual',
      createdAt: new Date('2024-01-05T00:00:00.000Z')
    })

    const all = await listUserTransactions({
      guildId: 'guild-1',
      userId: 'user-1'
    })
    expect(all.map((tx) => tx.amount)).toEqual([3, 2, 1])

    const bets = await listUserTransactions({
      guildId: 'guild-1',
      userId: 'user-1',
      types: ['bet', 'win'],
      limit: 1
    })
    expect(bets).toHaveLength(1)
    expect(bets[0]?.type).toBe('win')
    expect(bets[0]?.amount).toBe(3)
  })
})
