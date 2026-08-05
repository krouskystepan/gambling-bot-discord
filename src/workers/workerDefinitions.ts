import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  SECOND_MS
} from 'gambling-bot-shared/common'

import { Client } from 'commandkit'

import {
  baccaratIdleCloseJob,
  baccaratIdleNudgeJob,
  banRoleSyncJob,
  blackjackAutostandJob,
  blackjackIdleCloseJob,
  blackjackIdleNudgeJob,
  casinoInFlightRecoveryJob,
  guildOrphanCleanupJob,
  guildSettingsSyncJob,
  hiloIdleCloseJob,
  hiloIdleNudgeJob,
  hiloTimeoutJob,
  lockedBalanceReconciliationJob,
  minesAutoResolveJob,
  minesIdleCloseJob,
  minesIdleNudgeJob,
  predictionAutolockJob,
  raffleDrawJob,
  rouletteIdleCloseJob,
  rouletteIdleNudgeJob,
  slotsIdleCloseJob,
  slotsIdleNudgeJob,
  vipExpirationJob,
  vipExpiryWarningJob
} from './jobs'

const FIFTEEN_SECONDS = 15 * SECOND_MS
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
    // Warn before VIP ends, then strip expired VIP so roles/perks stay accurate.
    ['VIP expiry warning', vipExpiryWarningJob],
    ['VIP expiration', vipExpirationJob],
    // Lock prediction markets when their betting window ends.
    ['Prediction autolock', predictionAutolockJob],
    // Draw due raffles and pay winners without waiting for a command.
    ['Raffle auto-draw', raffleDrawJob]
  ]),
  ...withStartDelay(
    FIFTEEN_SECONDS,
    scheduleEvery(MINUTE_MS, [
      // Finish or refund games stuck mid-deal/spin after a crash or restart.
      ['Casino in-flight recovery', casinoInFlightRecoveryJob]
    ])
  ),
  ...withStartDelay(
    THIRTY_SECONDS,
    scheduleEvery(15 * MINUTE_MS, [
      // Hi-Lo waiting round: DM at 30m idle, then cash-out / safest guess after 1h.
      ['Hi-Lo idle nudge', hiloIdleNudgeJob],
      ['Hi-Lo timeout', hiloTimeoutJob]
    ])
  ),
  ...scheduleEvery(SIX_HOURS, [
    // Backfill/normalize guild settings so older configs match current defaults.
    ['Guild settings sync', guildSettingsSyncJob],
    // Keep Discord banned roles aligned with DB ban state.
    ['Ban role sync', banRoleSyncJob]
  ]),
  ...withStartDelay(
    THIRTY_SECONDS,
    scheduleEvery(HOUR_MS, [
      // Interactive casino: DM idle players, auto-resolve when needed, then
      // close abandoned sessions so locked bets are not stuck forever.
      ['Blackjack idle nudge', blackjackIdleNudgeJob],
      ['Blackjack auto-stand', blackjackAutostandJob],
      ['Blackjack idle close', blackjackIdleCloseJob],
      ['Baccarat idle nudge', baccaratIdleNudgeJob],
      ['Baccarat idle close', baccaratIdleCloseJob],
      ['Mines idle nudge', minesIdleNudgeJob],
      ['Mines auto-resolve', minesAutoResolveJob],
      ['Mines idle close', minesIdleCloseJob],
      ['Roulette idle nudge', rouletteIdleNudgeJob],
      ['Roulette idle close', rouletteIdleCloseJob],
      ['Slots idle nudge', slotsIdleNudgeJob],
      ['Slots idle close', slotsIdleCloseJob],
      // Close abandoned Hi-Lo BETTING / RESULT tables after 24h.
      ['Hi-Lo idle close', hiloIdleCloseJob]
    ])
  ),
  ...withStartDelay(
    MINUTE_MS,
    // Purge DB data for guilds the bot no longer belongs to.
    scheduleEvery(DAY_MS, [['Guild orphan cleanup', guildOrphanCleanupJob]])
  ),
  ...withStartDelay(
    MINUTE_MS,
    scheduleEvery(15 * MINUTE_MS, [
      // Safety net: unlock leftover balance that no longer matches an active bet.
      ['Locked balance reconciliation', lockedBalanceReconciliationJob]
    ])
  )
]
