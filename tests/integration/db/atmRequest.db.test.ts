import { describe, expect, it } from 'vitest'

import {
  attachAtmRequestMessage,
  completeAtmRequest,
  createAtmRequest,
  deleteAtmRequest,
  getAtmRequestCounts,
  getPendingAtmRequest,
  listAtmRequests
} from '@/services/db/atmRequest.db'

import { AtmRequest, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

describe('atmRequest.db', () => {
  it('creates and fetches a pending request', async () => {
    await createAtmRequest({
      requestId: 'atm-1',
      userId: 'user-1',
      guildId: 'guild-1',
      type: 'deposit',
      amount: 250,
      account: 'acc-1'
    })

    const pending = await getPendingAtmRequest('atm-1')
    expect(pending?.amount).toBe(250)
    expect(pending?.status).toBe('pending')
  })

  it('attaches log message ids to pending request', async () => {
    await createAtmRequest({
      requestId: 'atm-2',
      userId: 'user-1',
      guildId: 'guild-1',
      type: 'withdraw',
      amount: 100,
      account: 'acc-2'
    })

    await attachAtmRequestMessage('atm-2', 'log-ch', 'log-msg')

    const pending = await getPendingAtmRequest('atm-2')
    expect(pending?.logChannelId).toBe('log-ch')
    expect(pending?.logMessageId).toBe('log-msg')
  })

  it('completes pending request as approved', async () => {
    await createAtmRequest({
      requestId: 'atm-3',
      userId: 'user-1',
      guildId: 'guild-1',
      type: 'deposit',
      amount: 50,
      account: 'acc-3'
    })

    const completed = await completeAtmRequest({
      requestId: 'atm-3',
      status: 'approved',
      handledBy: 'mod-1'
    })

    expect(completed?.status).toBe('approved')
    expect(completed?.handledBy).toBe('mod-1')
    expect(await getPendingAtmRequest('atm-3')).toBeNull()
  })

  it('returns null when completing non-pending request', async () => {
    await createAtmRequest({
      requestId: 'atm-4',
      userId: 'user-1',
      guildId: 'guild-1',
      type: 'deposit',
      amount: 10,
      account: 'acc-4'
    })
    await completeAtmRequest({
      requestId: 'atm-4',
      status: 'rejected',
      handledBy: 'mod-1'
    })

    const second = await completeAtmRequest({
      requestId: 'atm-4',
      status: 'approved',
      handledBy: 'mod-2'
    })
    expect(second).toBeNull()
  })

  it('lists and counts requests by status', async () => {
    await createAtmRequest({
      requestId: 'atm-list-1',
      userId: 'user-1',
      guildId: 'guild-1',
      type: 'deposit',
      amount: 100,
      account: 'acc-a'
    })
    await createAtmRequest({
      requestId: 'atm-list-2',
      userId: 'user-2',
      guildId: 'guild-1',
      type: 'withdraw',
      amount: 50,
      account: 'acc-b'
    })
    await completeAtmRequest({
      requestId: 'atm-list-2',
      status: 'approved',
      handledBy: 'mod-1'
    })

    const pending = await listAtmRequests({
      guildId: 'guild-1',
      status: 'pending'
    })
    expect(pending.total).toBe(1)
    expect(pending.requests[0]?.requestId).toBe('atm-list-1')

    const counts = await getAtmRequestCounts({ guildId: 'guild-1' })
    expect(counts.pending).toBe(1)
    expect(counts.approved).toBe(1)
    expect(counts.total).toBe(2)
  })

  it('filters requests by date range and status array', async () => {
    await createAtmRequest({
      requestId: 'atm-date-1',
      userId: 'user-1',
      guildId: 'guild-1',
      type: 'deposit',
      amount: 10,
      account: 'acc-date-1'
    })
    await createAtmRequest({
      requestId: 'atm-date-2',
      userId: 'user-2',
      guildId: 'guild-1',
      type: 'withdraw',
      amount: 20,
      account: 'acc-date-2'
    })
    await createAtmRequest({
      requestId: 'atm-date-3',
      userId: 'user-3',
      guildId: 'guild-1',
      type: 'deposit',
      amount: 30,
      account: 'acc-date-3'
    })

    await AtmRequest.collection.updateOne(
      { requestId: 'atm-date-1' },
      { $set: { createdAt: new Date('2026-01-10T00:00:00Z') } }
    )
    await AtmRequest.collection.updateOne(
      { requestId: 'atm-date-2' },
      {
        $set: {
          createdAt: new Date('2026-02-10T00:00:00Z'),
          status: 'approved',
          handledBy: 'mod-1',
          handledAt: new Date()
        }
      }
    )
    await AtmRequest.collection.updateOne(
      { requestId: 'atm-date-3' },
      { $set: { createdAt: new Date('2026-03-10T00:00:00Z') } }
    )

    const ranged = await listAtmRequests({
      guildId: 'guild-1',
      dateFrom: '2026-02-01T00:00:00Z',
      dateTo: '2026-02-28T23:59:59Z'
    })
    expect(ranged.total).toBe(1)
    expect(ranged.requests[0]?.requestId).toBe('atm-date-2')

    const statuses = await listAtmRequests({
      guildId: 'guild-1',
      status: ['pending', 'approved']
    })
    expect(statuses.total).toBe(3)

    const byType = await listAtmRequests({
      guildId: 'guild-1',
      type: 'withdraw'
    })
    expect(byType.total).toBe(1)
    expect(byType.requests[0]?.requestId).toBe('atm-date-2')

    const byUser = await listAtmRequests({
      guildId: 'guild-1',
      userId: 'user-3'
    })
    expect(byUser.total).toBe(1)
    expect(byUser.requests[0]?.requestId).toBe('atm-date-3')

    const fromOnly = await listAtmRequests({
      guildId: 'guild-1',
      dateFrom: '2026-03-01T00:00:00Z'
    })
    expect(fromOnly.total).toBe(1)
    expect(fromOnly.requests[0]?.requestId).toBe('atm-date-3')

    const toOnly = await listAtmRequests({
      guildId: 'guild-1',
      dateTo: '2026-01-31T23:59:59Z'
    })
    expect(toOnly.total).toBe(1)
    expect(toOnly.requests[0]?.requestId).toBe('atm-date-1')
  })

  it('deletes request by id', async () => {
    await createAtmRequest({
      requestId: 'atm-5',
      userId: 'user-1',
      guildId: 'guild-1',
      type: 'withdraw',
      amount: 30,
      account: 'acc-5'
    })

    await deleteAtmRequest('atm-5')
    expect(await AtmRequest.countDocuments({ requestId: 'atm-5' })).toBe(0)
  })
})
