import type { TCasinoSettings } from 'gambling-bot-shared/casino'

import { createMultipleTransactions } from '@/services/db/transaction.db'
import { TCreateTransaction } from '@/services/db/transaction.db.types'

import {
  EVENT_WEIGHTS,
  type MockUserPools,
  VIP_ADMIN_ACTIONS,
  pickChipAmount,
  randomChoice,
  randomCreatedAt,
  randomInt,
  weightedRandomChoice
} from './constants'
import { simulateCasinoRound } from './simulateCasinoRound'

type SimTransaction = TCreateTransaction & { createdAt: Date }

export type MockTransactionsResult = {
  inserted: number
  typeCount: Record<string, number>
  casinoRounds: number
}

function createCasinoRound({
  guildId,
  pickUser,
  maxAmount,
  days,
  casinoSettings,
  userIds
}: {
  guildId: string
  pickUser: () => string
  maxAmount: number
  days: number
  casinoSettings: TCasinoSettings
  userIds: string[]
}): SimTransaction[] {
  const userId = pickUser()
  const betAt = randomCreatedAt(days)
  const round = simulateCasinoRound({
    casinoSettings,
    fallbackMaxBet: maxAmount,
    userId,
    userIds
  })

  return round.transactions.map((tx, index) => ({
    userId: tx.userId,
    guildId,
    amount: tx.amount,
    type: tx.type,
    source: 'casino' as const,
    referenceId: tx.referenceId,
    meta: { game: tx.game },
    createdAt: index === 0 ? betAt : randomCreatedAt(days, betAt)
  }))
}

function createBalanceTx({
  guildId,
  pickUser,
  pickAdmin,
  type,
  maxAmount,
  days
}: {
  guildId: string
  pickUser: () => string
  pickAdmin: () => string
  type: 'deposit' | 'withdraw'
  maxAmount: number
  days: number
}): SimTransaction {
  const isAtm = Math.random() < 0.7
  const source = isAtm ? 'manual' : 'command'
  const depositCap = maxAmount
  const withdrawCap = Math.min(maxAmount, 5000)

  const amount =
    type === 'withdraw'
      ? pickChipAmount(Math.max(10, Math.floor(withdrawCap * 0.65)))
      : pickChipAmount(depositCap)

  return {
    userId: pickUser(),
    guildId,
    amount,
    type,
    source,
    handledBy: pickAdmin(),
    createdAt: randomCreatedAt(days)
  }
}

function createBonusTx({
  guildId,
  pickUser,
  maxAmount,
  days
}: {
  guildId: string
  pickUser: () => string
  maxAmount: number
  days: number
}): SimTransaction {
  const streak = randomInt(1, 7)
  const base = Math.min(maxAmount, Math.max(10, Math.floor(maxAmount * 0.05)))
  const amount = Math.min(
    maxAmount,
    Math.max(5, Math.round(base * (1 + (streak - 1) * 0.05)))
  )

  return {
    userId: pickUser(),
    guildId,
    amount,
    type: 'bonus',
    source: 'system',
    meta: { bonusStreak: streak },
    createdAt: randomCreatedAt(days)
  }
}

function createVipTx({
  guildId,
  pickUser,
  pickAdmin,
  days
}: {
  guildId: string
  pickUser: () => string
  pickAdmin: () => string
  days: number
}): SimTransaction {
  const action = randomChoice(VIP_ADMIN_ACTIONS)

  return {
    userId: pickUser(),
    guildId,
    amount: 0,
    type: 'vip',
    source: 'command',
    handledBy: pickAdmin(),
    meta: {
      adminAction: action,
      ...(action === 'admin-add-member'
        ? { addedUserId: pickUser(), bypassUsed: Math.random() < 0.1 }
        : { durationDays: randomChoice([7, 14, 30, 60, 90]) })
    },
    createdAt: randomCreatedAt(days)
  }
}

function generateEventTransactions(
  event: keyof typeof EVENT_WEIGHTS,
  ctx: {
    guildId: string
    pickUser: () => string
    pickAdmin: () => string
    maxAmount: number
    days: number
    casinoSettings: TCasinoSettings
    userIds: string[]
  }
): SimTransaction[] {
  switch (event) {
    case 'casino_round':
      return createCasinoRound(ctx)
    case 'deposit':
      return [createBalanceTx({ ...ctx, type: 'deposit' })]
    case 'withdraw':
      return [createBalanceTx({ ...ctx, type: 'withdraw' })]
    case 'bonus':
      return [createBonusTx(ctx)]
    case 'vip':
      return [createVipTx(ctx)]
    default:
      return []
  }
}

export async function mockTransactions({
  guildId,
  pools,
  count,
  maxAmount = 1000,
  days = 30,
  casinoSettings
}: {
  guildId: string
  pools: MockUserPools
  count: number
  maxAmount?: number
  days?: number
  casinoSettings: TCasinoSettings
}): Promise<MockTransactionsResult> {
  const transactions: SimTransaction[] = []
  const typeCount: Record<string, number> = {}
  let casinoRounds = 0

  while (transactions.length < count) {
    const remaining = count - transactions.length
    let event = weightedRandomChoice(EVENT_WEIGHTS)

    if (remaining === 1 && event === 'casino_round') {
      event = weightedRandomChoice({
        deposit: 35,
        withdraw: 15,
        bonus: 25,
        vip: 25
      })
    }

    const batch = generateEventTransactions(event, {
      guildId,
      pickUser: pools.pickUser,
      pickAdmin: pools.pickAdmin,
      maxAmount,
      days,
      casinoSettings,
      userIds: pools.userIds
    })

    if (event === 'casino_round') {
      casinoRounds++
    }

    for (const tx of batch) {
      if (transactions.length >= count) break
      transactions.push(tx)
      typeCount[tx.type] = (typeCount[tx.type] ?? 0) + 1
    }
  }

  await createMultipleTransactions(transactions)

  return {
    inserted: transactions.length,
    typeCount,
    casinoRounds
  }
}
