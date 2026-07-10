import { type TAtmRequest } from 'gambling-bot-shared/atm'

import {
  completeAtmRequest,
  getUserAtmRequest
} from '@/services/db/atmRequest.db'
import { logger } from '@/utils/logger'

import {
  type AtmLogMessageClient,
  editAtmLogMessage
} from './atmLogMessage.service'

export type CancelAtmRequestResult =
  | { ok: true; request: TAtmRequest }
  | {
      ok: false
      code: 'NOT_FOUND' | 'NOT_PENDING' | 'RACE_CONDITION'
    }

export const cancelUserAtmRequest = async ({
  requestId,
  guildId,
  userId,
  type,
  client
}: {
  requestId: string
  guildId: string
  userId: string
  type: TAtmRequest['type']
  client: AtmLogMessageClient
}): Promise<CancelAtmRequestResult> => {
  const request = await getUserAtmRequest({
    requestId,
    guildId,
    userId,
    type
  })

  if (!request) return { ok: false, code: 'NOT_FOUND' }
  if (request.status !== 'pending') return { ok: false, code: 'NOT_PENDING' }

  const completed = await completeAtmRequest({
    requestId,
    status: 'cancelled',
    meta: { source: 'player-cancel' }
  })

  if (!completed) return { ok: false, code: 'RACE_CONDITION' }

  await editAtmLogMessage({
    client,
    request,
    content: `❌ Cancelled by <@${userId}>`
  })

  logger.event(
    {
      action:
        type === 'deposit' ? 'atm_deposit_cancelled' : 'atm_withdraw_cancelled',
      userId,
      requestId,
      guildId
    },
    type === 'deposit'
      ? 'ATM deposit request cancelled by player'
      : 'ATM withdrawal request cancelled by player'
  )

  return { ok: true, request: completed }
}
