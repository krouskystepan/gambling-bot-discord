import type { CasinoGameId } from 'gambling-bot-shared/casino'
import type { TPrediction } from 'gambling-bot-shared/predictions'

import Prediction from '@/models/Prediction'
import Transaction from '@/models/Transaction'
import { getBlackjackGameByUserAndGuild } from '@/services/db/blackjackGame.db'
import { getUser } from '@/services/db/user.db'

import {
  refundLockedBet,
  releaseExcessLockedBalance
} from './casinoBet.service'

export const LOCK_EPSILON = 0.0001
export const RECONCILIATION_GRACE_MS = 10 * 60 * 1000

const PREDICTION_LOCKED_STATUSES: TPrediction['status'][] = [
  'active',
  'ended',
  'paying'
]

type UnsettledBetTx = {
  referenceId: string
  amount: number
  createdAt: Date
  meta?: { game?: string }
}

type JustifiedBreakdown = {
  blackjack: number
  predictions: number
  graceBets: number
  pendingRps: number
}

const graceCutoff = () => new Date(Date.now() - RECONCILIATION_GRACE_MS)

async function getPredictionLockContext({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}) {
  const predictions = await Prediction.find({
    guildId,
    status: { $in: PREDICTION_LOCKED_STATUSES }
  }).lean()

  let total = 0
  const betIds = new Set<string>()

  for (const prediction of predictions) {
    for (const choice of prediction.choices) {
      for (const bet of choice.bets) {
        if (bet.userId === userId) {
          total += bet.amount
          betIds.add(bet.betId)
        }
      }
    }
  }

  return { total, betIds }
}

async function getUnsettledCasinoBetTxs({
  userId,
  guildId,
  createdAtFilter
}: {
  userId: string
  guildId: string
  createdAtFilter?: { $gte?: Date; $lt?: Date }
}): Promise<UnsettledBetTx[]> {
  const query: Record<string, unknown> = {
    userId,
    guildId,
    type: 'bet',
    source: 'casino',
    referenceId: { $ne: null }
  }

  if (createdAtFilter) {
    query.createdAt = createdAtFilter
  }

  const bets = await Transaction.find(query).lean()
  if (bets.length === 0) return []

  const referenceIds = [
    ...new Set(
      bets
        .map((bet) => bet.referenceId)
        .filter((ref): ref is string => Boolean(ref))
    )
  ]

  const settled = await Transaction.find({
    guildId,
    referenceId: { $in: referenceIds },
    type: { $in: ['win', 'refund'] }
  })
    .select('referenceId')
    .lean()

  const settledIds = new Set(
    settled
      .map((tx) => tx.referenceId)
      .filter((ref): ref is string => Boolean(ref))
  )

  return bets
    .filter((bet) => bet.referenceId && !settledIds.has(bet.referenceId))
    .map((bet) => ({
      referenceId: bet.referenceId!,
      amount: bet.amount,
      createdAt: bet.createdAt,
      meta: bet.meta as { game?: string } | undefined
    }))
}

async function getPendingRpsReferenceIds(
  guildId: string
): Promise<Set<string>> {
  const rpsBets = await Transaction.find({
    guildId,
    type: 'bet',
    source: 'casino',
    'meta.game': 'rps',
    referenceId: { $ne: null }
  }).lean()

  const betsByRef = new Map<string, number>()
  for (const bet of rpsBets) {
    if (!bet.referenceId) continue
    betsByRef.set(bet.referenceId, (betsByRef.get(bet.referenceId) ?? 0) + 1)
  }

  const candidateRefs = [...betsByRef.entries()]
    .filter(([, count]) => count >= 2)
    .map(([referenceId]) => referenceId)

  if (candidateRefs.length === 0) return new Set()

  const settled = await Transaction.find({
    guildId,
    referenceId: { $in: candidateRefs },
    type: { $in: ['win', 'refund'] }
  })
    .select('referenceId')
    .lean()

  const settledIds = new Set(
    settled
      .map((tx) => tx.referenceId)
      .filter((ref): ref is string => Boolean(ref))
  )

  return new Set(candidateRefs.filter((ref) => !settledIds.has(ref)))
}

export async function computeJustifiedLockedAmount({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}): Promise<{ justified: number; breakdown: JustifiedBreakdown }> {
  const breakdown: JustifiedBreakdown = {
    blackjack: 0,
    predictions: 0,
    graceBets: 0,
    pendingRps: 0
  }

  const blackjackGame = await getBlackjackGameByUserAndGuild({
    userId,
    guildId
  })
  if (blackjackGame) {
    breakdown.blackjack = blackjackGame.hands.reduce(
      (sum, hand) => sum + hand.betAmount,
      0
    )
  }

  const predictionContext = await getPredictionLockContext({ userId, guildId })
  breakdown.predictions = predictionContext.total

  const excludedFromCasinoBets = new Set(predictionContext.betIds)
  if (blackjackGame?.betId) {
    excludedFromCasinoBets.add(blackjackGame.betId)
  }

  const cutoff = graceCutoff()
  const graceBets = await getUnsettledCasinoBetTxs({
    userId,
    guildId,
    createdAtFilter: { $gte: cutoff }
  })
  breakdown.graceBets = graceBets
    .filter((bet) => !excludedFromCasinoBets.has(bet.referenceId))
    .reduce((sum, bet) => sum + bet.amount, 0)

  const pendingRpsRefs = await getPendingRpsReferenceIds(guildId)
  if (pendingRpsRefs.size > 0) {
    const olderRpsBets = await getUnsettledCasinoBetTxs({
      userId,
      guildId,
      createdAtFilter: { $lt: cutoff }
    })

    breakdown.pendingRps = olderRpsBets
      .filter(
        (bet) =>
          bet.meta?.game === 'rps' &&
          pendingRpsRefs.has(bet.referenceId) &&
          !excludedFromCasinoBets.has(bet.referenceId)
      )
      .reduce((sum, bet) => sum + bet.amount, 0)
  }

  const justified =
    breakdown.blackjack +
    breakdown.predictions +
    breakdown.graceBets +
    breakdown.pendingRps

  return { justified, breakdown }
}

export async function findOrphanBetRefunds({
  userId,
  guildId,
  maxExcess
}: {
  userId: string
  guildId: string
  maxExcess: number
}): Promise<{ betId: string; amount: number; game: CasinoGameId }[]> {
  const cutoff = graceCutoff()

  const [blackjackGame, predictionContext, pendingRpsRefs, oldBets] =
    await Promise.all([
      getBlackjackGameByUserAndGuild({ userId, guildId }),
      getPredictionLockContext({ userId, guildId }),
      getPendingRpsReferenceIds(guildId),
      getUnsettledCasinoBetTxs({
        userId,
        guildId,
        createdAtFilter: { $lt: cutoff }
      })
    ])

  const excludedRefs = new Set(predictionContext.betIds)
  if (blackjackGame?.betId) {
    excludedRefs.add(blackjackGame.betId)
  }

  const eligible = oldBets
    .filter((bet) => !excludedRefs.has(bet.referenceId))
    .filter(
      (bet) =>
        !(bet.meta?.game === 'rps' && pendingRpsRefs.has(bet.referenceId))
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  const orphans: { betId: string; amount: number; game: CasinoGameId }[] = []
  let remaining = maxExcess

  for (const bet of eligible) {
    if (remaining <= LOCK_EPSILON) break

    orphans.push({
      betId: bet.referenceId,
      amount: bet.amount,
      game: (bet.meta?.game ?? 'dice') as CasinoGameId
    })
    remaining -= bet.amount
  }

  return orphans
}

export type ReconcileUserLockedBalanceResult = {
  excessBefore: number
  refunded: number
  released: number
  orphanBetIds: string[]
}

export async function reconcileUserLockedBalance({
  userId,
  guildId
}: {
  userId: string
  guildId: string
}): Promise<ReconcileUserLockedBalanceResult | null> {
  const user = await getUser({ userId, guildId })
  if (!user || user.lockedBalance <= LOCK_EPSILON) return null

  const { justified } = await computeJustifiedLockedAmount({ userId, guildId })
  const excessBefore = user.lockedBalance - justified
  if (excessBefore <= LOCK_EPSILON) return null

  const orphans = await findOrphanBetRefunds({
    userId,
    guildId,
    maxExcess: excessBefore
  })

  let refunded = 0
  const orphanBetIds: string[] = []

  for (const orphan of orphans) {
    await refundLockedBet({
      userId,
      guildId,
      amount: orphan.amount,
      betId: orphan.betId,
      game: orphan.game
    })
    refunded += orphan.amount
    orphanBetIds.push(orphan.betId)
  }

  const userAfter = await getUser({ userId, guildId })
  const { justified: justifiedAfter } = await computeJustifiedLockedAmount({
    userId,
    guildId
  })

  const remainder =
    (userAfter?.lockedBalance ?? 0) - (justifiedAfter ?? justified)
  let released = 0

  if (remainder > LOCK_EPSILON) {
    await releaseExcessLockedBalance({
      userId,
      guildId,
      amount: remainder
    })
    released = remainder
  }

  return { excessBefore, refunded, released, orphanBetIds }
}
