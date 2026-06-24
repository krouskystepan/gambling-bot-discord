import type { TAtmRequest } from 'gambling-bot-shared/atm'
import { generateId } from 'gambling-bot-shared/common'

import AtmRequest from '@/models/AtmRequest'

import {
  type MockUserPools,
  pickChipAmount,
  randomAtmAccount,
  randomChoice,
  randomCreatedAt,
  weightedRandomChoice
} from './constants'

export type MockAtmRequestsResult = {
  inserted: number
  statusCount: Record<string, number>
}

const STATUS_WEIGHTS = {
  approved: 62,
  pending: 18,
  rejected: 20
} as const

export async function mockAtmRequests({
  guildId,
  pools,
  count,
  days = 30,
  maxAmount = 5000
}: {
  guildId: string
  pools: MockUserPools
  count: number
  days?: number
  maxAmount?: number
}): Promise<MockAtmRequestsResult> {
  const docs: Array<
    Pick<
      TAtmRequest,
      | 'requestId'
      | 'guildId'
      | 'userId'
      | 'type'
      | 'amount'
      | 'account'
      | 'status'
      | 'handledBy'
      | 'handledAt'
      | 'notes'
      | 'createdAt'
      | 'updatedAt'
    >
  > = []

  const statusCount: Record<string, number> = {}

  for (let i = 0; i < count; i++) {
    const status = weightedRandomChoice(STATUS_WEIGHTS)
    const type = Math.random() < 0.58 ? 'deposit' : 'withdraw'
    const createdAt = randomCreatedAt(days)
    const handledBy = status === 'pending' ? undefined : pools.pickAdmin()

    statusCount[status] = (statusCount[status] ?? 0) + 1

    docs.push({
      requestId: generateId(),
      guildId,
      userId: pools.pickUser(),
      type,
      amount: pickChipAmount(maxAmount),
      account: randomAtmAccount(),
      status,
      handledBy,
      handledAt:
        status === 'pending'
          ? undefined
          : new Date(
              createdAt.getTime() + randomChoice([5, 15, 45, 120]) * 60_000
            ),
      notes:
        status === 'rejected'
          ? randomChoice([
              'Invalid proof of payment',
              'Account mismatch',
              'Duplicate request',
              'Insufficient verification'
            ])
          : undefined,
      createdAt,
      updatedAt: createdAt
    })
  }

  await AtmRequest.insertMany(docs)

  return { inserted: docs.length, statusCount }
}
