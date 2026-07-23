import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  SECOND_MS
} from 'gambling-bot-shared/common'

import { Client } from 'commandkit'

import {
  baccaratIdleNudgeJob,
  baccaratIdleRefundJob,
  banRoleSyncJob,
  blackjackAutostandJob,
  blackjackIdleNudgeJob,
  guildOrphanCleanupJob,
  guildSettingsSyncJob,
  lockedBalanceReconciliationJob,
  minesAutoResolveJob,
  minesIdleNudgeJob,
  predictionAutolockJob,
  raffleDrawJob,
  vipExpirationJob,
  vipExpiryWarningJob
} from './jobs'

const THIRTY_SECONDS = 30 * SECOND_MS
const SIX_HOURS = 6 * HOUR_MS

type WorkerJob = (client: Client<true>) => Promise<void>
type WorkerEntry = readonly [name: string, run: WorkerJob]

export type WorkerDefinition = {
  name: string
  intervalMs: number
  startDelayMs?: number
  run: WorkerJob
}

const scheduleEvery = (
  intervalMs: number,
  workers: readonly WorkerEntry[]
): WorkerDefinition[] =>
  workers.map(([name, run]) => ({ name, intervalMs, run }))

const withStartDelay = (
  startDelayMs: number,
  workers: readonly WorkerDefinition[]
): WorkerDefinition[] =>
  workers.map((worker) => ({
    ...worker,
    startDelayMs
  }))

export const workerDefinitions: WorkerDefinition[] = [
  ...scheduleEvery(MINUTE_MS, [
    ['VIP expiry warning', vipExpiryWarningJob],
    ['VIP expiration', vipExpirationJob],
    ['Prediction autolock', predictionAutolockJob],
    ['Raffle auto-draw', raffleDrawJob]
  ]),
  ...scheduleEvery(SIX_HOURS, [
    ['Guild settings sync', guildSettingsSyncJob],
    ['Ban role sync', banRoleSyncJob]
  ]),
  ...withStartDelay(
    THIRTY_SECONDS,
    scheduleEvery(HOUR_MS, [
      ['Blackjack idle nudge', blackjackIdleNudgeJob],
      ['Blackjack auto-stand', blackjackAutostandJob],
      ['Baccarat idle nudge', baccaratIdleNudgeJob],
      ['Baccarat idle refund', baccaratIdleRefundJob],
      ['Mines idle nudge', minesIdleNudgeJob],
      ['Mines auto-resolve', minesAutoResolveJob]
    ])
  ),
  ...withStartDelay(
    MINUTE_MS,
    scheduleEvery(DAY_MS, [['Guild orphan cleanup', guildOrphanCleanupJob]])
  ),
  ...withStartDelay(
    MINUTE_MS,
    scheduleEvery(15 * MINUTE_MS, [
      ['Locked balance reconciliation', lockedBalanceReconciliationJob]
    ])
  )
]
