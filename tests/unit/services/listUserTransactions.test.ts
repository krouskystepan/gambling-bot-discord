import { beforeEach, describe, expect, it, vi } from 'vitest'

import Transaction from '@/models/Transaction'
import { listUserTransactions } from '@/services/db/transaction.db'

vi.mock('@/models/Transaction', () => ({
  default: {
    find: vi.fn()
  }
}))

const mockFind = vi.mocked(Transaction.find)

const createQueryChain = (result: unknown[] = []) => {
  const lean = vi.fn().mockResolvedValue(result)
  const limit = vi.fn().mockReturnValue({ lean })
  const sort = vi.fn().mockReturnValue({ limit })
  mockFind.mockReturnValue({ sort } as never)
  return { sort, limit, lean }
}

describe('listUserTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries by guild/user, excludes staff-audit rows, sorts and limits', async () => {
    const { sort, limit, lean } = createQueryChain([{ amount: 10 }])

    const result = await listUserTransactions({
      guildId: 'guild-1',
      userId: 'user-1'
    })

    expect(mockFind).toHaveBeenCalledWith({
      guildId: 'guild-1',
      userId: 'user-1',
      $or: [
        { 'meta.adminAction': { $exists: false } },
        { 'meta.adminAction': null }
      ]
    })
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(limit).toHaveBeenCalledWith(15)
    expect(lean).toHaveBeenCalled()
    expect(result).toEqual([{ amount: 10 }])
  })

  it('applies type $in filter when types are provided', async () => {
    createQueryChain()

    await listUserTransactions({
      guildId: 'guild-1',
      userId: 'user-1',
      types: ['bet', 'win'],
      limit: 10
    })

    expect(mockFind).toHaveBeenCalledWith({
      guildId: 'guild-1',
      userId: 'user-1',
      type: { $in: ['bet', 'win'] },
      $or: [
        { 'meta.adminAction': { $exists: false } },
        { 'meta.adminAction': null }
      ]
    })
  })

  it('omits type filter when types is empty', async () => {
    createQueryChain()

    await listUserTransactions({
      guildId: 'guild-1',
      userId: 'user-1',
      types: []
    })

    expect(mockFind).toHaveBeenCalledWith({
      guildId: 'guild-1',
      userId: 'user-1',
      $or: [
        { 'meta.adminAction': { $exists: false } },
        { 'meta.adminAction': null }
      ]
    })
  })
})
