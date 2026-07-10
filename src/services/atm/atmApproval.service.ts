import { type TAtmRequest } from 'gambling-bot-shared/atm'
import { formatMoney } from 'gambling-bot-shared/common'

import { Client, TextChannel } from 'discord.js'

import {
  completeAtmRequest,
  createTransaction,
  getGuildConfigByGuildId,
  getPendingAtmRequest,
  previewWithdraw,
  updateUserBalanceAtomic
} from '@/services/db'
import {
  createErrorEmbed,
  createSuccessEmbed
} from '@/utils/discord/createEmbed'

import { editAtmLogMessage } from './atmLogMessage.service'

export type AtmApprovalSource = 'discord' | 'web'

export type AtmApprovalResult =
  | { ok: true; request: TAtmRequest }
  | {
      ok: false
      code:
        | 'NOT_PENDING'
        | 'RACE_CONDITION'
        | 'INSUFFICIENT_BALANCE'
        | 'GUILD_NOT_CONFIGURED'
        | 'CREDIT_FAILED'
    }

const buildTransactionMeta = ({
  request,
  notes
}: {
  request: TAtmRequest
  notes?: string
}) => ({
  account: request.account,
  ...(notes ? { notes } : {})
})

const notifyAtmUser = async ({
  client,
  guildId,
  userId,
  embed
}: {
  client: Client
  guildId: string
  userId: string
  embed: ReturnType<typeof createSuccessEmbed>
}) => {
  const guildConfig = await getGuildConfigByGuildId({ guildId })
  const actionChannelId = guildConfig?.atmChannelIds.actions
  if (!actionChannelId) return

  const actionChannel = client.channels.cache.get(
    actionChannelId
  ) as TextChannel
  if (!actionChannel) return

  await actionChannel.send({
    content: `<@${userId}>`,
    embeds: [embed]
  })
}

export const rejectAtmRequest = async ({
  requestId,
  handledBy,
  notes,
  source,
  client
}: {
  requestId: string
  handledBy: string
  notes?: string
  source: AtmApprovalSource
  client?: Client
}): Promise<AtmApprovalResult> => {
  const request = await getPendingAtmRequest(requestId)
  if (!request) return { ok: false, code: 'NOT_PENDING' }

  const completed = await completeAtmRequest({
    requestId,
    status: 'rejected',
    handledBy,
    notes,
    meta: { source, ...(notes ? { notes } : {}) }
  })

  if (!completed) return { ok: false, code: 'RACE_CONDITION' }

  if (client && source === 'discord') {
    const guildConfig = await getGuildConfigByGuildId({
      guildId: request.guildId
    })
    const readableAmount = formatMoney(
      request.amount,
      guildConfig?.globalSettings
    )
    const actionWord = request.type === 'deposit' ? 'Deposit' : 'Withdrawal'

    await editAtmLogMessage({
      client,
      request,
      content: `❌ Rejected by <@${handledBy}>`
    })

    await notifyAtmUser({
      client,
      guildId: request.guildId,
      userId: request.userId,
      embed: createErrorEmbed(
        'ATM Transaction Rejected',
        `${actionWord} of **${readableAmount}** rejected.`
      )
    })
  }

  return { ok: true, request: completed }
}

export const approveAtmRequest = async ({
  requestId,
  handledBy,
  notes,
  source,
  client
}: {
  requestId: string
  handledBy: string
  notes?: string
  source: AtmApprovalSource
  client?: Client
}): Promise<AtmApprovalResult> => {
  const request = await getPendingAtmRequest(requestId)
  if (!request) return { ok: false, code: 'NOT_PENDING' }

  const guildConfig = await getGuildConfigByGuildId({
    guildId: request.guildId
  })
  if (!guildConfig) return { ok: false, code: 'GUILD_NOT_CONFIGURED' }

  const { userId, amount, type, guildId } = request
  const readableAmount = formatMoney(amount, guildConfig.globalSettings)
  const txMeta = buildTransactionMeta({ request, notes })

  if (type === 'deposit') {
    const completed = await completeAtmRequest({
      requestId,
      status: 'approved',
      handledBy,
      notes,
      meta: { source, ...txMeta }
    })

    if (!completed) return { ok: false, code: 'RACE_CONDITION' }

    const updatedUser = await updateUserBalanceAtomic({
      userId,
      guildId,
      balanceDelta: amount
    })

    if (!updatedUser) return { ok: false, code: 'CREDIT_FAILED' }

    await createTransaction({
      userId,
      guildId,
      amount,
      type: 'deposit',
      source: source === 'web' ? 'web' : 'manual',
      handledBy,
      referenceId: requestId,
      meta: txMeta
    })

    if (client && source === 'discord') {
      await editAtmLogMessage({
        client,
        request: completed,
        content: `✅ Approved by <@${handledBy}>`
      })

      await notifyAtmUser({
        client,
        guildId,
        userId,
        embed: createSuccessEmbed(
          'ATM Transaction Approved',
          `Deposit of **${readableAmount}** approved.`
        )
      })
    }

    return { ok: true, request: completed }
  }

  const withdrawPreview = await previewWithdraw({ userId, guildId, amount })
  if (!withdrawPreview.ok) {
    const completed = await completeAtmRequest({
      requestId,
      status: 'rejected',
      handledBy,
      notes: notes ?? 'Insufficient available balance at approval',
      meta: { source, reason: withdrawPreview.reason, ...txMeta }
    })

    if (!completed) return { ok: false, code: 'RACE_CONDITION' }

    if (client && source === 'discord') {
      await notifyAtmUser({
        client,
        guildId,
        userId,
        embed: createErrorEmbed(
          'Withdrawal Failed',
          `Your withdrawal of **${readableAmount}** could not be completed because your available balance changed before approval.`
        )
      })

      await editAtmLogMessage({
        client,
        request: completed,
        content: `❌ Rejected by <@${handledBy}> - user had insufficient available balance at time of approval.`
      })
    }

    return { ok: false, code: 'INSUFFICIENT_BALANCE' }
  }

  const updatedUser = await updateUserBalanceAtomic({
    userId,
    guildId,
    balanceDelta: -amount,
    requireAvailableGte: amount
  })

  if (!updatedUser) {
    const completed = await completeAtmRequest({
      requestId,
      status: 'rejected',
      handledBy,
      notes: notes ?? 'Insufficient available balance at approval',
      meta: { source, reason: 'INSUFFICIENT_BALANCE', ...txMeta }
    })

    if (!completed) return { ok: false, code: 'RACE_CONDITION' }

    if (client && source === 'discord') {
      await notifyAtmUser({
        client,
        guildId,
        userId,
        embed: createErrorEmbed(
          'Withdrawal Failed',
          `Your withdrawal of **${readableAmount}** could not be completed because your available balance changed before approval.`
        )
      })

      await editAtmLogMessage({
        client,
        request: completed,
        content: `❌ Rejected by <@${handledBy}> - user had insufficient available balance at time of approval.`
      })
    }

    return { ok: false, code: 'INSUFFICIENT_BALANCE' }
  }

  const completed = await completeAtmRequest({
    requestId,
    status: 'approved',
    handledBy,
    notes,
    meta: { source, ...txMeta }
  })

  if (!completed) {
    await updateUserBalanceAtomic({
      userId,
      guildId,
      balanceDelta: amount
    })

    return { ok: false, code: 'RACE_CONDITION' }
  }

  await createTransaction({
    userId,
    guildId,
    amount,
    type: 'withdraw',
    source: source === 'web' ? 'web' : 'manual',
    handledBy,
    referenceId: requestId,
    meta: txMeta
  })

  if (client && source === 'discord') {
    await editAtmLogMessage({
      client,
      request: completed,
      content: `✅ Approved by <@${handledBy}>`
    })

    await notifyAtmUser({
      client,
      guildId,
      userId,
      embed: createSuccessEmbed(
        'ATM Transaction Approved',
        `Withdrawal of **${readableAmount}** approved.`
      )
    })
  }

  return { ok: true, request: completed }
}
