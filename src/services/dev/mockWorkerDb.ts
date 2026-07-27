import type { Card } from 'gambling-bot-shared/blackjack'
import {
  blackjackAutostandIdleMs,
  blackjackIdleNudgeThresholdMs
} from 'gambling-bot-shared/blackjack'
import { HOUR_MS, generateId } from 'gambling-bot-shared/common'
import {
  createMinesEngine,
  minesAutoResolveIdleMs,
  minesIdleNudgeThresholdMs
} from 'gambling-bot-shared/mines'
import type { VipExpiryWarningTier } from 'gambling-bot-shared/vip'

import BlackjackGame from '@/models/BlackjackGame'
import MinesGame from '@/models/MinesGame'
import Raffle from '@/models/Raffle'
import Transaction from '@/models/Transaction'
import User from '@/models/User'
import VipRoom from '@/models/VipRoom'
import { reserveCasinoBet } from '@/services/casino/casinoBet.service'
import { RECONCILIATION_GRACE_MS } from '@/services/casino/lockedBalanceReconciliation.service'
import { upsertBlackjackGame } from '@/services/db/blackjackGame.db'
import { upsertMinesGame } from '@/services/db/minesGame.db'
import { createPrediction } from '@/services/db/prediction.db'
import { upsertRaffle } from '@/services/db/raffle.db'

import { fakeChannelId, fakeDiscordSnowflake } from './constants'

export type WorkerMockEntity =
  | 'all'
  | 'locked-balance'
  | 'blackjack-idle-nudge'
  | 'blackjack-autostand'
  | 'mines-idle-nudge'
  | 'mines-autostand'
  | 'vip-expired'
  | 'vip-expiry-warning'
  | 'prediction-autolock'
  | 'raffle-draw'

export type WorkerMockOptions = {
  guildId: string
  invokingUserId: string
  entity: WorkerMockEntity
  count?: number
  vipWarningTier?: 'both' | VipExpiryWarningTier
}

export type WorkerMockSummary = {
  entity: WorkerMockEntity
  lines: string[]
}

const DEFAULT_COUNT = 1
const MAX_COUNT = 5
const FUNDING_BALANCE = 50_000

const testCard = (label: Card['label'], value: number): Card => ({
  suite: '♠️',
  label,
  value
})

function clampCount(count?: number): number {
  if (count == null) return DEFAULT_COUNT
  return Math.min(MAX_COUNT, Math.max(1, count))
}

function formatUserRef(userId: string, invokingUserId: string): string {
  return userId === invokingUserId ? `<@${userId}>` : `\`${userId}\``
}

/** Invoking user first; synthetic snowflakes for additional unique slots. */
function pickTestUserIds(invokingUserId: string, count: number): string[] {
  const ids = [invokingUserId]
  while (ids.length < count) {
    const syntheticId = fakeDiscordSnowflake()
    if (!ids.includes(syntheticId)) ids.push(syntheticId)
  }
  return ids.slice(0, count)
}

async function ensureFundedUser(
  userId: string,
  guildId: string
): Promise<void> {
  await User.updateOne(
    { userId, guildId },
    {
      $setOnInsert: {
        userId,
        guildId,
        balance: FUNDING_BALANCE,
        lockedBalance: 0,
        bonusBalance: 0
      }
    },
    { upsert: true }
  )

  await User.updateOne(
    { userId, guildId, balance: { $lt: FUNDING_BALANCE } },
    { $set: { balance: FUNDING_BALANCE } }
  )
}

async function backdateBetTx(betId: string, ageMs: number): Promise<void> {
  await Transaction.collection.updateOne(
    { referenceId: betId, type: 'bet' },
    { $set: { createdAt: new Date(Date.now() - ageMs) } }
  )
}

async function setBlackjackUpdatedAt(
  userId: string,
  guildId: string,
  updatedAt: Date
): Promise<void> {
  await BlackjackGame.collection.updateOne(
    { userId, guildId },
    { $set: { updatedAt } }
  )
}

async function pickBlackjackUsers(
  guildId: string,
  invokingUserId: string,
  count: number
): Promise<string[]> {
  const candidates = pickTestUserIds(invokingUserId, count)
  const available: string[] = []

  for (const userId of candidates) {
    const existing = await BlackjackGame.exists({ userId, guildId })
    if (!existing) available.push(userId)
    if (available.length >= count) break
  }

  while (available.length < count) {
    const syntheticId = fakeDiscordSnowflake()
    const existing = await BlackjackGame.exists({
      userId: syntheticId,
      guildId
    })
    if (!existing && !available.includes(syntheticId)) {
      available.push(syntheticId)
    }
  }

  return available.slice(0, count)
}

async function seedLockedBalanceOrphans({
  guildId,
  invokingUserId,
  count
}: {
  guildId: string
  invokingUserId: string
  count: number
}): Promise<string[]> {
  const lines: string[] = []

  for (let i = 0; i < count; i++) {
    await ensureFundedUser(invokingUserId, guildId)

    const betId = generateId()
    const useBlackjackOrphan = i % 2 === 1

    if (useBlackjackOrphan) {
      await reserveCasinoBet({
        userId: invokingUserId,
        guildId,
        totalBet: 100,
        betId,
        game: 'blackjack'
      })
      await backdateBetTx(betId, RECONCILIATION_GRACE_MS + 60_000)
      lines.push(
        `🔒 Orphan blackjack lock for ${formatUserRef(invokingUserId, invokingUserId)} (\`${betId}\`, no active game)`
      )
    } else {
      await reserveCasinoBet({
        userId: invokingUserId,
        guildId,
        totalBet: 75,
        betId,
        game: 'dice'
      })
      await backdateBetTx(betId, RECONCILIATION_GRACE_MS + 60_000)
      lines.push(
        `🔒 Orphan dice lock for ${formatUserRef(invokingUserId, invokingUserId)} (\`${betId}\`, past grace window)`
      )
    }
  }

  return lines
}

async function seedBlackjackGame({
  guildId,
  userId,
  invokingUserId,
  updatedAt
}: {
  guildId: string
  userId: string
  invokingUserId: string
  updatedAt: Date
}): Promise<string> {
  await ensureFundedUser(userId, guildId)

  const betId = generateId()
  const channelId = fakeChannelId()
  const messageId = fakeDiscordSnowflake()

  await reserveCasinoBet({
    userId,
    guildId,
    totalBet: 100,
    betId,
    game: 'blackjack'
  })

  await upsertBlackjackGame({
    userId,
    guildId,
    channelId,
    messageId,
    betId,
    deck: [],
    deckIndex: 0,
    hands: [
      {
        cards: [testCard('10', 10), testCard('8', 8)],
        betAmount: 100,
        finished: false,
        isSplitHand: false
      }
    ],
    activeHandIndex: 0,
    phase: 'PLAYER',
    dealerCards: [testCard('10', 10), testCard('7', 7)]
  })

  await setBlackjackUpdatedAt(userId, guildId, updatedAt)

  return `🃏 Blackjack game for ${formatUserRef(userId, invokingUserId)} (\`${betId}\`, updated ${updatedAt.toISOString()})`
}

async function seedBlackjackIdleNudges({
  guildId,
  invokingUserId,
  count
}: {
  guildId: string
  invokingUserId: string
  count: number
}): Promise<string[]> {
  const idleMs = blackjackIdleNudgeThresholdMs() + Math.floor(HOUR_MS * 0.5)
  const updatedAt = new Date(Date.now() - idleMs)
  const userIds = await pickBlackjackUsers(guildId, invokingUserId, count)
  const lines: string[] = []

  for (const userId of userIds) {
    lines.push(
      await seedBlackjackGame({
        guildId,
        userId,
        invokingUserId,
        updatedAt
      })
    )
  }

  lines.unshift(
    '⏰ Idle nudge window: games idle 3h+ but within the 24h auto-stand window'
  )

  return lines
}

async function seedBlackjackAutostands({
  guildId,
  invokingUserId,
  count
}: {
  guildId: string
  invokingUserId: string
  count: number
}): Promise<string[]> {
  const updatedAt = new Date(Date.now() - blackjackAutostandIdleMs() - HOUR_MS)
  const userIds = await pickBlackjackUsers(guildId, invokingUserId, count)
  const lines: string[] = []

  for (const userId of userIds) {
    lines.push(
      await seedBlackjackGame({
        guildId,
        userId,
        invokingUserId,
        updatedAt
      })
    )
  }

  lines.unshift('⏳ Auto-stand window: games idle 24h+')

  return lines
}

async function setMinesUpdatedAt(
  userId: string,
  guildId: string,
  updatedAt: Date
): Promise<void> {
  await MinesGame.collection.updateOne(
    { userId, guildId },
    { $set: { updatedAt } }
  )
}

async function pickMinesUsers(
  guildId: string,
  invokingUserId: string,
  count: number
): Promise<string[]> {
  const candidates = pickTestUserIds(invokingUserId, count)
  const available: string[] = []

  for (const userId of candidates) {
    const existing = await MinesGame.exists({ userId, guildId })
    if (!existing) available.push(userId)
    if (available.length >= count) break
  }

  while (available.length < count) {
    const syntheticId = fakeDiscordSnowflake()
    const existing = await MinesGame.exists({
      userId: syntheticId,
      guildId
    })
    if (!existing && !available.includes(syntheticId)) {
      available.push(syntheticId)
    }
  }

  return available.slice(0, count)
}

async function seedMinesGame({
  guildId,
  userId,
  invokingUserId,
  updatedAt,
  withReveal
}: {
  guildId: string
  userId: string
  invokingUserId: string
  updatedAt: Date
  withReveal: boolean
}): Promise<string> {
  await ensureFundedUser(userId, guildId)

  const betId = generateId()
  const channelId = fakeChannelId()
  const messageId = fakeDiscordSnowflake()
  const engine = createMinesEngine({
    betAmount: 100,
    mineCount: 3,
    houseEdgeSnapshot: 0.03,
    mineIndices: [0, 1, 2]
  })

  if (withReveal) {
    engine.revealedIndices = [5]
  }

  await reserveCasinoBet({
    userId,
    guildId,
    totalBet: 100,
    betId,
    game: 'mines'
  })

  await upsertMinesGame({
    userId,
    guildId,
    channelId,
    messageId,
    betId,
    betAmount: engine.betAmount,
    mineCount: engine.mineCount,
    mineIndices: engine.mineIndices,
    revealedIndices: engine.revealedIndices,
    houseEdgeSnapshot: engine.houseEdgeSnapshot,
    status: 'ACTIVE'
  })

  await setMinesUpdatedAt(userId, guildId, updatedAt)

  return `💣 Mines game for ${formatUserRef(userId, invokingUserId)} (\`${betId}\`, updated ${updatedAt.toISOString()})`
}

async function seedMinesIdleNudges({
  guildId,
  invokingUserId,
  count
}: {
  guildId: string
  invokingUserId: string
  count: number
}): Promise<string[]> {
  const idleMs = minesIdleNudgeThresholdMs() + Math.floor(HOUR_MS * 0.5)
  const updatedAt = new Date(Date.now() - idleMs)
  const userIds = await pickMinesUsers(guildId, invokingUserId, count)
  const lines: string[] = []

  for (const userId of userIds) {
    lines.push(
      await seedMinesGame({
        guildId,
        userId,
        invokingUserId,
        updatedAt,
        withReveal: true
      })
    )
  }

  lines.unshift(
    '⏰ Idle nudge window: games idle 3h+ but within the 24h auto-resolve window'
  )

  return lines
}

async function seedMinesAutostands({
  guildId,
  invokingUserId,
  count
}: {
  guildId: string
  invokingUserId: string
  count: number
}): Promise<string[]> {
  const updatedAt = new Date(Date.now() - minesAutoResolveIdleMs() - HOUR_MS)
  const userIds = await pickMinesUsers(guildId, invokingUserId, count)
  const lines: string[] = []

  for (let i = 0; i < userIds.length; i++) {
    lines.push(
      await seedMinesGame({
        guildId,
        userId: userIds[i]!,
        invokingUserId,
        updatedAt,
        withReveal: i % 2 === 0
      })
    )
  }

  lines.unshift('⏳ Auto-resolve window: games idle 24h+')

  return lines
}

async function seedExpiredVipRooms({
  guildId,
  invokingUserId,
  count
}: {
  guildId: string
  invokingUserId: string
  count: number
}): Promise<string[]> {
  const lines: string[] = []
  const owners = pickTestUserIds(invokingUserId, count)

  for (let i = 0; i < count; i++) {
    const ownerId = owners[i]!
    const expiresAt = new Date(Date.now() - (i + 1) * HOUR_MS)

    try {
      await VipRoom.create({
        ownerId,
        guildId,
        channelId: fakeChannelId(),
        memberIds: [],
        expiresAt,
        expiryWarningsSent: []
      })
      lines.push(
        `👑 Expired VIP for ${formatUserRef(ownerId, invokingUserId)} (expired ${expiresAt.toISOString()})`
      )
    } catch {
      lines.push(
        `⚠️ Skipped VIP for ${formatUserRef(ownerId, invokingUserId)} — room already exists`
      )
    }
  }

  return lines
}

async function seedVipExpiryWarnings({
  guildId,
  invokingUserId,
  count,
  tier
}: {
  guildId: string
  invokingUserId: string
  count: number
  tier: 'both' | VipExpiryWarningTier
}): Promise<string[]> {
  const lines: string[] = []
  const tiers: VipExpiryWarningTier[] = tier === 'both' ? ['24h', '1h'] : [tier]
  const owners = pickTestUserIds(
    invokingUserId,
    tier === 'both' ? Math.max(count, 2) : count
  )
  let ownerIndex = 0

  for (const warningTier of tiers) {
    const tierCount =
      tier === 'both' ? Math.max(1, Math.ceil(count / 2)) : count

    for (let i = 0; i < tierCount; i++) {
      const ownerId = owners[ownerIndex % owners.length]!
      ownerIndex++

      const expiresAt =
        warningTier === '24h'
          ? new Date(Date.now() + 12 * HOUR_MS)
          : new Date(Date.now() + 30 * 60 * 1000)

      try {
        await VipRoom.create({
          ownerId,
          guildId,
          channelId: fakeChannelId(),
          memberIds: [],
          expiresAt,
          expiryWarningsSent: []
        })
        lines.push(
          `⚠️ VIP ${warningTier} warning for ${formatUserRef(ownerId, invokingUserId)} (expires ${expiresAt.toISOString()})`
        )
      } catch {
        lines.push(
          `⚠️ Skipped VIP ${warningTier} warning for ${formatUserRef(ownerId, invokingUserId)} — room already exists`
        )
      }
    }
  }

  return lines
}

async function seedPredictionAutolocks({
  guildId,
  invokingUserId,
  count
}: {
  guildId: string
  invokingUserId: string
  count: number
}): Promise<string[]> {
  const lines: string[] = []
  const autolock = new Date(Date.now() - HOUR_MS)

  for (let i = 0; i < count; i++) {
    const predictionId = fakeDiscordSnowflake()

    await createPrediction({
      predictionId,
      guildId,
      channelId: fakeChannelId(),
      creatorId: invokingUserId,
      title: `Worker test prediction ${i + 1}`,
      choices: [
        { choiceName: 'Yes', odds: 2, bets: [] },
        { choiceName: 'No', odds: 1.5, bets: [] }
      ],
      autolock,
      status: 'active'
    })

    lines.push(
      `🔮 Prediction \`${predictionId}\` past autolock (${autolock.toISOString()})`
    )
  }

  return lines
}

async function seedRaffleDraws({
  guildId,
  invokingUserId,
  count
}: {
  guildId: string
  invokingUserId: string
  count: number
}): Promise<string[]> {
  const lines: string[] = []
  const nextDrawAt = new Date(Date.now() - HOUR_MS)
  const secondParticipant = fakeDiscordSnowflake()

  for (let i = 0; i < count; i++) {
    const drawId = generateId()
    const raffleId = fakeDiscordSnowflake()

    await upsertRaffle({
      raffleId,
      drawId,
      guildId,
      creatorId: invokingUserId,
      channelId: fakeChannelId(),
      ticketPrice: 10,
      maxTicketsPerUser: 10,
      nextDrawAt,
      drawIntervalMs: 24 * HOUR_MS
    })

    await Raffle.updateOne(
      { raffleId, guildId },
      {
        $set: {
          status: 'active',
          participants: [
            { userId: invokingUserId, tickets: 3 },
            { userId: secondParticipant, tickets: 2 }
          ]
        }
      }
    )

    await ensureFundedUser(invokingUserId, guildId)
    await ensureFundedUser(secondParticipant, guildId)

    lines.push(
      `🎟️ Raffle \`${raffleId}\` ready to draw (${nextDrawAt.toISOString()})`
    )
  }

  return lines
}

const ENTITY_RUNNERS: Record<
  Exclude<WorkerMockEntity, 'all'>,
  (ctx: {
    guildId: string
    invokingUserId: string
    count: number
    vipWarningTier: 'both' | VipExpiryWarningTier
  }) => Promise<string[]>
> = {
  'locked-balance': ({ guildId, invokingUserId, count }) =>
    seedLockedBalanceOrphans({ guildId, invokingUserId, count }),
  'blackjack-idle-nudge': ({ guildId, invokingUserId, count }) =>
    seedBlackjackIdleNudges({ guildId, invokingUserId, count }),
  'blackjack-autostand': ({ guildId, invokingUserId, count }) =>
    seedBlackjackAutostands({ guildId, invokingUserId, count }),
  'mines-idle-nudge': ({ guildId, invokingUserId, count }) =>
    seedMinesIdleNudges({ guildId, invokingUserId, count }),
  'mines-autostand': ({ guildId, invokingUserId, count }) =>
    seedMinesAutostands({ guildId, invokingUserId, count }),
  'vip-expired': ({ guildId, invokingUserId, count }) =>
    seedExpiredVipRooms({ guildId, invokingUserId, count }),
  'vip-expiry-warning': ({ guildId, invokingUserId, count, vipWarningTier }) =>
    seedVipExpiryWarnings({
      guildId,
      invokingUserId,
      count,
      tier: vipWarningTier
    }),
  'prediction-autolock': ({ guildId, invokingUserId, count }) =>
    seedPredictionAutolocks({ guildId, invokingUserId, count }),
  'raffle-draw': ({ guildId, invokingUserId, count }) =>
    seedRaffleDraws({ guildId, invokingUserId, count })
}

const ALL_ENTITIES = Object.keys(ENTITY_RUNNERS) as Exclude<
  WorkerMockEntity,
  'all'
>[]

export async function runMockWorkerDb(
  options: WorkerMockOptions
): Promise<WorkerMockSummary> {
  const count = clampCount(options.count)
  const vipWarningTier = options.vipWarningTier ?? 'both'

  const entities: Exclude<WorkerMockEntity, 'all'>[] =
    options.entity === 'all' ? ALL_ENTITIES : [options.entity]

  const lines: string[] = []

  for (const entity of entities) {
    const entityLines = await ENTITY_RUNNERS[entity]({
      guildId: options.guildId,
      invokingUserId: options.invokingUserId,
      count,
      vipWarningTier
    })

    if (entityLines.length > 0) {
      lines.push(`**${entity}**`, ...entityLines, '')
    }
  }

  return {
    entity: options.entity,
    lines: lines.length > 0 ? lines : ['No worker test data was seeded.']
  }
}
