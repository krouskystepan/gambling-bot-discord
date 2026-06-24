import { defaultCasinoSettings } from 'gambling-bot-shared/casino'
import { formatNumberToReadableString } from 'gambling-bot-shared/common'

import { PermissionFlagsBits } from 'discord.js'

import { getGuildConfigByGuildId } from '@/services/db/guildConfiguration.db'

import {
  MOCK_SCALE_PRESETS,
  type MockScale,
  type MockScalePreset,
  resolveMockUserPools
} from './constants'
import { mockAtmRequests } from './mockAtmRequests'
import { mockPredictions } from './mockPredictions'
import { mockRaffles } from './mockRaffles'
import { mockTransactions } from './mockTransactions'
import { mockUsers, syncMockUserBalancesFromTransactions } from './mockUsers'
import { mockVipRooms } from './mockVipRooms'

export type MockDbEntity =
  | 'all'
  | 'users'
  | 'transactions'
  | 'atm'
  | 'raffles'
  | 'predictions'
  | 'vip'

export type MockDbOptions = {
  guildId: string
  invokingUserId: string
  entity: MockDbEntity
  scale: MockScale
  preset?: Partial<MockScalePreset>
  maxAmount?: number
  useGuildUsers?: boolean
  guild: {
    members: {
      fetch: (opts?: {
        withPresences?: boolean
      }) => Promise<Map<string, unknown>>
      cache: {
        filter: (
          fn: (m: {
            user: { bot: boolean }
            permissions: { has: (flag: bigint) => boolean }
            id: string
          }) => boolean
        ) => { map: (fn: (m: { id: string }) => string) => string[] }
      }
    }
  }
}

export type MockDbSummary = {
  entity: MockDbEntity
  scale: MockScale
  users: number
  lines: string[]
}

function mergePreset(
  scale: MockScale,
  overrides?: Partial<MockScalePreset>
): MockScalePreset {
  return { ...MOCK_SCALE_PRESETS[scale], ...overrides }
}

export async function runMockDb(
  options: MockDbOptions
): Promise<MockDbSummary> {
  const preset = mergePreset(options.scale, options.preset)
  const useGuildUsers = options.useGuildUsers ?? false

  const pools = await resolveMockUserPools({
    guildId: options.guildId,
    userCount: preset.users,
    invokingUserId: options.invokingUserId,
    useGuildUsers,
    fetchMemberIds: async () => {
      const members = await options.guild.members.fetch({
        withPresences: false
      })
      return [...members.keys()]
    },
    getAdminIds: () =>
      options.guild.members.cache
        .filter(
          (m) =>
            !m.user.bot &&
            (m.permissions.has(PermissionFlagsBits.Administrator) ||
              m.permissions.has(PermissionFlagsBits.ManageGuild))
        )
        .map((m) => m.id)
  })

  const lines: string[] = []
  const maxAmount = options.maxAmount ?? 1000
  const entity = options.entity
  const seedsTransactions = entity === 'all' || entity === 'transactions'

  const guildConfig = await getGuildConfigByGuildId({
    guildId: options.guildId
  })
  const casinoSettings = guildConfig?.casinoSettings ?? defaultCasinoSettings

  if (entity === 'all' || entity === 'users') {
    const users = await mockUsers({
      guildId: options.guildId,
      pools,
      days: preset.days,
      zeroBalance: seedsTransactions
    })
    lines.push(
      `👥 **Users**: ${formatNumberToReadableString(users.created)} created, ${formatNumberToReadableString(users.skipped)} already existed`
    )
  }

  if (seedsTransactions) {
    const txs = await mockTransactions({
      guildId: options.guildId,
      pools,
      count: preset.transactions,
      maxAmount,
      days: preset.days,
      casinoSettings
    })
    const breakdown = Object.entries(txs.typeCount)
      .sort(([, a], [, b]) => b - a)
      .map(([type, c]) => `${type}: ${formatNumberToReadableString(c)}`)
      .join(', ')
    lines.push(
      `💸 **Transactions**: ${formatNumberToReadableString(txs.inserted)} (${formatNumberToReadableString(txs.casinoRounds)} casino rounds)\n   └ ${breakdown}`
    )

    if (entity === 'all' || entity === 'transactions') {
      const synced = await syncMockUserBalancesFromTransactions({
        guildId: options.guildId,
        userIds: pools.userIds
      })
      lines.push(
        `💰 **Balances synced** from transaction history for ${formatNumberToReadableString(synced)} users`
      )
    }
  }

  if (entity === 'all' || entity === 'atm') {
    const atm = await mockAtmRequests({
      guildId: options.guildId,
      pools,
      count: preset.atmRequests,
      days: preset.days,
      maxAmount: Math.max(maxAmount, 5000)
    })
    const statusLine = Object.entries(atm.statusCount)
      .map(([s, c]) => `${s}: ${c}`)
      .join(', ')
    lines.push(
      `🏧 **ATM requests**: ${formatNumberToReadableString(atm.inserted)} (${statusLine})`
    )
  }

  if (entity === 'all' || entity === 'raffles') {
    const raffles = await mockRaffles({
      guildId: options.guildId,
      pools,
      count: preset.raffles,
      days: preset.days
    })
    lines.push(
      `🎟️ **Raffles**: ${formatNumberToReadableString(raffles.inserted)} (${raffles.active} active, ${raffles.canceled} canceled, ${formatNumberToReadableString(raffles.totalTickets)} tickets)`
    )
  }

  if (entity === 'all' || entity === 'predictions') {
    const predictions = await mockPredictions({
      guildId: options.guildId,
      pools,
      count: preset.predictions,
      days: preset.days,
      maxBet: maxAmount
    })
    lines.push(
      `🔮 **Predictions**: ${formatNumberToReadableString(predictions.inserted)} (${formatNumberToReadableString(predictions.totalBets)} bets)`
    )
  }

  if (entity === 'all' || entity === 'vip') {
    const vip = await mockVipRooms({
      guildId: options.guildId,
      pools,
      count: preset.vipRooms,
      days: preset.days
    })
    lines.push(
      `👑 **VIP rooms**: ${formatNumberToReadableString(vip.inserted)} (${vip.active} active, ${vip.expired} expired, ${formatNumberToReadableString(vip.totalMembers)} members)`
    )
  }

  return {
    entity,
    scale: options.scale,
    users: pools.userIds.length,
    lines
  }
}

export {
  MOCK_SCALE_PRESETS,
  parseMockScale,
  resolveMockUserPools
} from './constants'

export {
  formatClearMockDbSummary,
  runClearMockDb,
  type ClearMockDbEntity,
  type ClearMockDbSummary
} from './clearMockDb'
