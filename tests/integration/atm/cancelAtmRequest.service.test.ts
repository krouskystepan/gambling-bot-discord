import { describe, expect, it, vi } from 'vitest'

import { cancelUserAtmRequest } from '@/services/atm/cancelAtmRequest.service'
import {
  attachAtmRequestMessage,
  createAtmRequest,
  getPendingAtmRequest
} from '@/services/db/atmRequest.db'
import * as atmRequestDb from '@/services/db/atmRequest.db'
import { logger } from '@/utils/logger'

import { createMockDiscordClient } from '../../helpers/discord-client-mock'
import { setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const seedPendingDeposit = async (
  requestId: string,
  {
    userId = 'user-1',
    withLogMessage = false
  }: { userId?: string; withLogMessage?: boolean } = {}
) => {
  await createAtmRequest({
    requestId,
    userId,
    guildId: 'guild-1',
    type: 'deposit',
    amount: 100,
    account: 'acc-1'
  })

  if (withLogMessage) {
    await attachAtmRequestMessage(requestId, 'log-ch', 'log-msg')
  }
}

describe('cancelUserAtmRequest', () => {
  it('returns NOT_FOUND when request does not belong to user', async () => {
    await seedPendingDeposit('cancel-not-found', { userId: 'user-1' })
    const { client } = createMockDiscordClient()

    const result = await cancelUserAtmRequest({
      requestId: 'cancel-not-found',
      guildId: 'guild-1',
      userId: 'user-2',
      type: 'deposit',
      client: client as never
    })

    expect(result).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('returns NOT_PENDING when request is already approved', async () => {
    await seedPendingDeposit('cancel-not-pending')
    const { client } = createMockDiscordClient()

    vi.spyOn(atmRequestDb, 'getUserAtmRequest').mockResolvedValueOnce({
      requestId: 'cancel-not-pending',
      guildId: 'guild-1',
      userId: 'user-1',
      type: 'deposit',
      amount: 100,
      account: 'acc-1',
      status: 'approved',
      createdAt: new Date(),
      updatedAt: new Date()
    } as never)

    const result = await cancelUserAtmRequest({
      requestId: 'cancel-not-pending',
      guildId: 'guild-1',
      userId: 'user-1',
      type: 'deposit',
      client: client as never
    })

    expect(result).toEqual({ ok: false, code: 'NOT_PENDING' })
    vi.restoreAllMocks()
  })

  it('returns RACE_CONDITION when completion fails', async () => {
    await seedPendingDeposit('cancel-race')
    const pending = await getPendingAtmRequest('cancel-race')
    const { client } = createMockDiscordClient()

    vi.spyOn(atmRequestDb, 'getUserAtmRequest').mockResolvedValueOnce(pending)
    vi.spyOn(atmRequestDb, 'completeAtmRequest').mockResolvedValueOnce(null)

    const result = await cancelUserAtmRequest({
      requestId: 'cancel-race',
      guildId: 'guild-1',
      userId: 'user-1',
      type: 'deposit',
      client: client as never
    })

    expect(result).toEqual({ ok: false, code: 'RACE_CONDITION' })
    vi.restoreAllMocks()
  })

  it('cancels pending request and updates staff log message', async () => {
    await seedPendingDeposit('cancel-happy', { withLogMessage: true })
    const { client, logMessageEdit } = createMockDiscordClient()
    const eventSpy = vi.spyOn(logger, 'event')

    const result = await cancelUserAtmRequest({
      requestId: 'cancel-happy',
      guildId: 'guild-1',
      userId: 'user-1',
      type: 'deposit',
      client: client as never
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.status).toBe('cancelled')
    expect(result.request.handledBy).toBeUndefined()
    expect(result.request.meta).toMatchObject({ source: 'player-cancel' })
    expect(await getPendingAtmRequest('cancel-happy')).toBeNull()
    expect(logMessageEdit).toHaveBeenCalledWith({
      content: '❌ Cancelled by <@user-1>',
      components: []
    })
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'atm_deposit_cancelled',
        userId: 'user-1',
        requestId: 'cancel-happy'
      }),
      'ATM deposit request cancelled by player'
    )
    eventSpy.mockRestore()
  })

  it('logs withdraw cancellation event', async () => {
    await createAtmRequest({
      requestId: 'cancel-withdraw',
      userId: 'user-1',
      guildId: 'guild-1',
      type: 'withdraw',
      amount: 50,
      account: 'acc-1'
    })
    const { client } = createMockDiscordClient()
    const eventSpy = vi.spyOn(logger, 'event')

    const result = await cancelUserAtmRequest({
      requestId: 'cancel-withdraw',
      guildId: 'guild-1',
      userId: 'user-1',
      type: 'withdraw',
      client: client as never
    })

    expect(result.ok).toBe(true)
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'atm_withdraw_cancelled' }),
      'ATM withdrawal request cancelled by player'
    )
    eventSpy.mockRestore()
  })
})
