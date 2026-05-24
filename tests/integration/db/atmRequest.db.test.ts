import { describe, expect, it } from 'vitest'

import {
  attachAtmRequestMessage,
  completeAtmRequest,
  createAtmRequest,
  deleteAtmRequest,
  getPendingAtmRequest
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
