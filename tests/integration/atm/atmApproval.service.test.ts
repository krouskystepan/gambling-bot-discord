import { describe, expect, it, vi } from 'vitest'

import {
  attachAtmRequestMessage,
  createAtmRequest,
  getPendingAtmRequest
} from '@/services/db/atmRequest.db'
import { createGuildConfiguration } from '@/services/db/guildConfiguration.db'
import * as atmRequestDb from '@/services/db/atmRequest.db'
import * as userDb from '@/services/db/user.db'
import {
  approveAtmRequest,
  rejectAtmRequest
} from '@/services/atm/atmApproval.service'
import { logger } from '@/utils/logger'

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string, description: string) => ({
    title,
    description
  }),
  createSuccessEmbed: (title: string, description: string) => ({
    title,
    description
  })
}))

import { createMockDiscordClient } from '../../helpers/discord-client-mock'
import {
  GuildConfiguration,
  Transaction,
  User,
  createTestUser,
  setupMongoTests
} from '../../helpers/mongo'

setupMongoTests()

const seedGuild = async () => {
  await createGuildConfiguration({ guildId: 'guild-1' })
  await GuildConfiguration.updateOne(
    { guildId: 'guild-1' },
    {
      $set: {
        'atmChannelIds.actions': 'action-ch',
        'atmChannelIds.logs': 'log-ch'
      }
    }
  )
}

const seedPendingDeposit = async (
  requestId: string,
  {
    amount = 100,
    withLogMessage = false
  }: { amount?: number; withLogMessage?: boolean } = {}
) => {
  await createAtmRequest({
    requestId,
    userId: 'user-1',
    guildId: 'guild-1',
    type: 'deposit',
    amount,
    account: 'acc-1'
  })

  if (withLogMessage) {
    await attachAtmRequestMessage(requestId, 'log-ch', 'log-msg')
  }
}

const seedPendingWithdraw = async (
  requestId: string,
  {
    amount = 50,
    withLogMessage = false
  }: { amount?: number; withLogMessage?: boolean } = {}
) => {
  await createAtmRequest({
    requestId,
    userId: 'user-1',
    guildId: 'guild-1',
    type: 'withdraw',
    amount,
    account: 'acc-1'
  })

  if (withLogMessage) {
    await attachAtmRequestMessage(requestId, 'log-ch', 'log-msg')
  }
}

describe('rejectAtmRequest', () => {
  it('returns NOT_PENDING when request is missing', async () => {
    const result = await rejectAtmRequest({
      requestId: 'missing',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'NOT_PENDING' })
  })

  it('returns RACE_CONDITION when completion fails', async () => {
    await seedPendingDeposit('reject-race')
    const pending = await getPendingAtmRequest('reject-race')

    vi.spyOn(atmRequestDb, 'getPendingAtmRequest').mockResolvedValueOnce(pending)
    vi.spyOn(atmRequestDb, 'completeAtmRequest').mockResolvedValueOnce(null)

    const result = await rejectAtmRequest({
      requestId: 'reject-race',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'RACE_CONDITION' })
    vi.restoreAllMocks()
  })

  it('rejects pending request without discord notifications for web', async () => {
    await seedPendingDeposit('reject-web')

    const result = await rejectAtmRequest({
      requestId: 'reject-web',
      handledBy: 'mod-1',
      notes: 'invalid proof',
      source: 'web'
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.status).toBe('rejected')
    expect(result.request.meta).toMatchObject({
      source: 'web',
      notes: 'invalid proof'
    })
  })

  it('rejects deposit via discord and updates log and user messages', async () => {
    await seedGuild()
    await seedPendingDeposit('reject-discord-deposit', { withLogMessage: true })
    const { client, logMessageEdit, actionChannelSend } =
      createMockDiscordClient()

    const result = await rejectAtmRequest({
      requestId: 'reject-discord-deposit',
      handledBy: 'mod-1',
      source: 'discord',
      client
    })

    expect(result.ok).toBe(true)
    expect(logMessageEdit).toHaveBeenCalledWith({
      content: '❌ Rejected by <@mod-1>',
      components: []
    })
    expect(actionChannelSend).toHaveBeenCalledOnce()
  })

  it('rejects withdrawal via discord with withdrawal wording', async () => {
    await seedGuild()
    await seedPendingWithdraw('reject-discord-withdraw', {
      withLogMessage: true
    })
    const { client, actionChannelSend } = createMockDiscordClient()

    const result = await rejectAtmRequest({
      requestId: 'reject-discord-withdraw',
      handledBy: 'mod-1',
      source: 'discord',
      client
    })

    expect(result.ok).toBe(true)
    expect(actionChannelSend.mock.calls[0]?.[0]?.embeds?.[0]?.description).toContain(
      'Withdrawal'
    )
  })

  it('skips log edit when message ids are missing', async () => {
    await seedGuild()
    await seedPendingDeposit('reject-no-log')
    const { client, channelsFetch } = createMockDiscordClient()

    await rejectAtmRequest({
      requestId: 'reject-no-log',
      handledBy: 'mod-1',
      source: 'discord',
      client
    })

    expect(channelsFetch).not.toHaveBeenCalled()
  })

  it('logs when discord log message edit fails', async () => {
    await seedGuild()
    await seedPendingDeposit('reject-log-error', { withLogMessage: true })
    const { client } = createMockDiscordClient({ fetchLogChannel: false })

    await rejectAtmRequest({
      requestId: 'reject-log-error',
      handledBy: 'mod-1',
      source: 'discord',
      client
    })

    expect(logger.error).toHaveBeenCalled()
  })

  it('skips user notification when action channel is not configured', async () => {
    await createGuildConfiguration({ guildId: 'guild-2' })
    await createAtmRequest({
      requestId: 'reject-no-action',
      userId: 'user-1',
      guildId: 'guild-2',
      type: 'deposit',
      amount: 10,
      account: 'acc-1'
    })
    const { client, actionChannelSend } = createMockDiscordClient()

    await rejectAtmRequest({
      requestId: 'reject-no-action',
      handledBy: 'mod-1',
      source: 'discord',
      client
    })

    expect(actionChannelSend).not.toHaveBeenCalled()
  })

  it('skips user notification when action channel is not cached', async () => {
    await seedGuild()
    await seedPendingDeposit('reject-no-cache')
    const { client, actionChannelSend } = createMockDiscordClient({
      cacheActionChannel: false
    })

    await rejectAtmRequest({
      requestId: 'reject-no-cache',
      handledBy: 'mod-1',
      source: 'discord',
      client
    })

    expect(actionChannelSend).not.toHaveBeenCalled()
  })
})

describe('approveAtmRequest', () => {
  it('returns NOT_PENDING when request is missing', async () => {
    const result = await approveAtmRequest({
      requestId: 'missing',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'NOT_PENDING' })
  })

  it('returns GUILD_NOT_CONFIGURED when guild config is missing', async () => {
    await seedPendingDeposit('approve-no-guild')

    const result = await approveAtmRequest({
      requestId: 'approve-no-guild',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'GUILD_NOT_CONFIGURED' })
  })

  it('approves deposit on web and credits balance', async () => {
    await seedGuild()
    await createTestUser({ balance: 100 })
    await seedPendingDeposit('approve-deposit-web', { amount: 75 })

    const result = await approveAtmRequest({
      requestId: 'approve-deposit-web',
      handledBy: 'mod-1',
      notes: 'verified',
      source: 'web'
    })

    expect(result.ok).toBe(true)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(175)

    const tx = await Transaction.findOne({
      userId: 'user-1',
      type: 'deposit',
      source: 'web'
    })
    expect(tx?.amount).toBe(75)
    expect(tx?.meta).toMatchObject({
      requestId: 'approve-deposit-web',
      notes: 'verified'
    })
  })

  it('approves deposit on discord and notifies user', async () => {
    await seedGuild()
    await createTestUser({ balance: 0 })
    await seedPendingDeposit('approve-deposit-discord', {
      amount: 40,
      withLogMessage: true
    })
    const { client, logMessageEdit, actionChannelSend } =
      createMockDiscordClient()

    const result = await approveAtmRequest({
      requestId: 'approve-deposit-discord',
      handledBy: 'mod-1',
      source: 'discord',
      client
    })

    expect(result.ok).toBe(true)
    expect(logMessageEdit).toHaveBeenCalledWith({
      content: '✅ Approved by <@mod-1>',
      components: []
    })
    expect(actionChannelSend.mock.calls[0]?.[0]?.embeds?.[0]?.description).toContain(
      'Deposit'
    )
  })

  it('returns RACE_CONDITION when deposit completion fails', async () => {
    await seedGuild()
    await createTestUser({ balance: 0 })
    await seedPendingDeposit('approve-deposit-race')
    const pending = await getPendingAtmRequest('approve-deposit-race')

    vi.spyOn(atmRequestDb, 'getPendingAtmRequest').mockResolvedValueOnce(pending)
    vi.spyOn(atmRequestDb, 'completeAtmRequest').mockResolvedValueOnce(null)

    const result = await approveAtmRequest({
      requestId: 'approve-deposit-race',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'RACE_CONDITION' })
    vi.restoreAllMocks()
  })

  it('returns CREDIT_FAILED when user is missing during deposit approval', async () => {
    await seedGuild()
    await seedPendingDeposit('approve-deposit-credit-fail')

    const result = await approveAtmRequest({
      requestId: 'approve-deposit-credit-fail',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'CREDIT_FAILED' })
  })

  it('approves withdrawal on web and debits balance', async () => {
    await seedGuild()
    await createTestUser({ balance: 200, lockedBalance: 0 })
    await seedPendingWithdraw('approve-withdraw-web', { amount: 60 })

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-web',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result.ok).toBe(true)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(140)

    const tx = await Transaction.findOne({
      userId: 'user-1',
      type: 'withdraw',
      source: 'web'
    })
    expect(tx?.amount).toBe(60)
  })

  it('approves withdrawal on discord and notifies user', async () => {
    await seedGuild()
    await createTestUser({ balance: 150, lockedBalance: 0 })
    await seedPendingWithdraw('approve-withdraw-discord', {
      amount: 25,
      withLogMessage: true
    })
    const { client, logMessageEdit, actionChannelSend } =
      createMockDiscordClient()

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-discord',
      handledBy: 'mod-1',
      source: 'discord',
      client
    })

    expect(result.ok).toBe(true)
    expect(logMessageEdit).toHaveBeenCalled()
    expect(actionChannelSend.mock.calls[0]?.[0]?.embeds?.[0]?.description).toContain(
      'Withdrawal'
    )
  })

  it('rejects withdrawal when preview shows insufficient withdrawable funds', async () => {
    await seedGuild()
    await createTestUser({ balance: 100, lockedBalance: 70 })
    await seedPendingWithdraw('approve-withdraw-preview-fail', { amount: 50 })

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-preview-fail',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'INSUFFICIENT_BALANCE' })

    const request = await atmRequestDb.getPendingAtmRequest(
      'approve-withdraw-preview-fail'
    )
    expect(request).toBeNull()
  })

  it('rejects withdrawal when preview shows insufficient withdrawable funds with custom notes', async () => {
    await seedGuild()
    await createTestUser({ balance: 100, lockedBalance: 70 })
    await seedPendingWithdraw('approve-withdraw-preview-notes', { amount: 50 })

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-preview-notes',
      handledBy: 'mod-1',
      notes: 'balance changed',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'INSUFFICIENT_BALANCE' })
  })

  it('returns RACE_CONDITION when rejecting insufficient preview withdrawal races', async () => {
    await seedGuild()
    await createTestUser({ balance: 100, lockedBalance: 70 })
    await seedPendingWithdraw('approve-withdraw-preview-race', { amount: 50 })
    const pending = await getPendingAtmRequest('approve-withdraw-preview-race')

    vi.spyOn(atmRequestDb, 'getPendingAtmRequest').mockResolvedValueOnce(pending)
    vi.spyOn(atmRequestDb, 'completeAtmRequest').mockResolvedValueOnce(null)

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-preview-race',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'RACE_CONDITION' })
    vi.restoreAllMocks()
  })

  it('notifies user on discord when preview shows insufficient withdrawable funds', async () => {
    await seedGuild()
    await createTestUser({ balance: 100, lockedBalance: 70 })
    await seedPendingWithdraw('approve-withdraw-preview-discord', {
      amount: 50,
      withLogMessage: true
    })
    const { client, actionChannelSend, logMessageEdit } =
      createMockDiscordClient()

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-preview-discord',
      handledBy: 'mod-1',
      source: 'discord',
      client
    })

    expect(result).toEqual({ ok: false, code: 'INSUFFICIENT_BALANCE' })
    expect(actionChannelSend).toHaveBeenCalledOnce()
    expect(logMessageEdit).toHaveBeenCalled()
  })

  it('rejects withdrawal when balance update fails after preview succeeds', async () => {
    await seedGuild()
    await createTestUser({ balance: 100, lockedBalance: 0 })
    await seedPendingWithdraw('approve-withdraw-update-fail', { amount: 40 })

    vi.spyOn(userDb, 'updateUserBalanceAtomic').mockResolvedValueOnce(null)

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-update-fail',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'INSUFFICIENT_BALANCE' })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(100)
    vi.restoreAllMocks()
  })

  it('rejects withdrawal when balance update fails with custom notes', async () => {
    await seedGuild()
    await createTestUser({ balance: 100, lockedBalance: 0 })
    await seedPendingWithdraw('approve-withdraw-update-notes', { amount: 40 })

    vi.spyOn(userDb, 'updateUserBalanceAtomic').mockResolvedValueOnce(null)

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-update-notes',
      handledBy: 'mod-1',
      notes: 'funds moved',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'INSUFFICIENT_BALANCE' })
    vi.restoreAllMocks()
  })

  it('returns RACE_CONDITION when rejecting failed withdrawal update races', async () => {
    await seedGuild()
    await createTestUser({ balance: 100, lockedBalance: 0 })
    await seedPendingWithdraw('approve-withdraw-update-race', { amount: 40 })

    vi.spyOn(userDb, 'updateUserBalanceAtomic').mockResolvedValueOnce(null)
    vi.spyOn(atmRequestDb, 'completeAtmRequest').mockResolvedValueOnce(null)

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-update-race',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'RACE_CONDITION' })
    vi.restoreAllMocks()
  })

  it('notifies user on discord when balance update fails after preview succeeds', async () => {
    await seedGuild()
    await createTestUser({ balance: 100, lockedBalance: 0 })
    await seedPendingWithdraw('approve-withdraw-update-discord', {
      amount: 40,
      withLogMessage: true
    })
    const { client, actionChannelSend, logMessageEdit } =
      createMockDiscordClient()

    vi.spyOn(userDb, 'updateUserBalanceAtomic').mockResolvedValueOnce(null)

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-update-discord',
      handledBy: 'mod-1',
      source: 'discord',
      client
    })

    expect(result).toEqual({ ok: false, code: 'INSUFFICIENT_BALANCE' })
    expect(actionChannelSend).toHaveBeenCalledOnce()
    expect(logMessageEdit).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('rolls back balance when withdrawal completion races', async () => {
    await seedGuild()
    await createTestUser({ balance: 100, lockedBalance: 0 })
    await seedPendingWithdraw('approve-withdraw-race', { amount: 30 })

    const completeSpy = vi
      .spyOn(atmRequestDb, 'completeAtmRequest')
      .mockResolvedValueOnce(null)

    const result = await approveAtmRequest({
      requestId: 'approve-withdraw-race',
      handledBy: 'mod-1',
      source: 'web'
    })

    expect(result).toEqual({ ok: false, code: 'RACE_CONDITION' })

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(100)
    completeSpy.mockRestore()
  })

  it('uses manual transaction source for discord approvals', async () => {
    await seedGuild()
    await createTestUser({ balance: 50 })
    await seedPendingDeposit('approve-deposit-manual', { amount: 10 })

    await approveAtmRequest({
      requestId: 'approve-deposit-manual',
      handledBy: 'mod-1',
      source: 'discord'
    })

    const tx = await Transaction.findOne({
      userId: 'user-1',
      type: 'deposit',
      source: 'manual'
    })
    expect(tx?.amount).toBe(10)
  })
})
