import { Client } from 'commandkit'

import {
  blackjackAutostandJob,
  blackjackIdleNudgeJob,
  guildOrphanCleanupJob,
  guildSettingsSyncJob,
  predictionAutolockJob,
  predictionCleanupJob,
  raffleDrawJob,
  vipExpirationJob
} from './jobs'

const THIRTY_SECONDS = 30 * 1000

const ONE_MINUTE = 60 * 1000

const ONE_HOUR = 60 * ONE_MINUTE
const SIX_HOURS = 6 * ONE_HOUR

const ONE_DAY = 24 * 60 * ONE_MINUTE

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
  ...scheduleEvery(ONE_MINUTE, [
    ['VIP expiration', vipExpirationJob],
    ['Prediction autolock', predictionAutolockJob],
    ['Raffle auto-draw', raffleDrawJob]
  ]),
  ...scheduleEvery(SIX_HOURS, [['Guild settings sync', guildSettingsSyncJob]]),
  ...withStartDelay(
    THIRTY_SECONDS,
    scheduleEvery(ONE_HOUR, [
      ['Blackjack idle nudge', blackjackIdleNudgeJob],
      ['Blackjack auto-stand', blackjackAutostandJob]
    ])
  ),
  ...withStartDelay(
    ONE_MINUTE,
    scheduleEvery(ONE_DAY, [
      ['Prediction cleanup', predictionCleanupJob],
      ['Guild orphan cleanup', guildOrphanCleanupJob]
    ])
  )
]
