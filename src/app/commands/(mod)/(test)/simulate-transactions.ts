import { CASINO_GAME_IDS, type CasinoGameId } from 'gambling-bot-shared/casino'
import {
  formatNumberToReadableString,
  generateId,
  parseReadableStringToNumber
} from 'gambling-bot-shared/common'

import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js'

import { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit'

import { handleUnexpectedInteractionError } from '@/errors'
import { createMultipleTransactions, getGuildUserIds } from '@/services'
import { TCreateTransaction } from '@/types/types'
import { DEV_GUILDS } from '@/utils/devGuilds'

export const command: CommandData = {
  name: 'simulate-transactions',
  description: 'Simulate X transactions for testing filtering and indexing.',
  options: [
    {
      name: 'count',
      description: 'Number of transactions to simulate.',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'max-amount',
      description: 'Maximum amount per transaction (upper bound).',
      type: ApplicationCommandOptionType.String,
      required: false
    },
    {
      name: 'days',
      description: 'How many past days to simulate over (default: 30).',
      type: ApplicationCommandOptionType.Integer,
      required: false
    },
    {
      name: 'unique-users',
      description: 'Number of distinct users to simulate (default: auto).',
      type: ApplicationCommandOptionType.Integer,
      required: false
    },
    {
      name: 'use-guild-users',
      description:
        'Use real guild members / DB users instead of random IDs (default: true).',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    }
  ],
  dm_permission: false
}

export const metadata: CommandMetadata = {
  userPermissions: ['Administrator'],
  botPermissions: ['Administrator'],
  guilds: DEV_GUILDS
}

type SimTransaction = TCreateTransaction & { createdAt: Date }

const EVENT_WEIGHTS = {
  casino_round: 52,
  deposit: 14,
  withdraw: 9,
  bonus: 12,
  vip: 5,
  refund_round: 8
} as const

const BET_CHIPS = [
  10, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 2500, 5000, 10_000
]

const VIP_ADMIN_ACTIONS = [
  'admin-buy',
  'admin-extend',
  'admin-add-member'
] as const

function weightedRandomChoice<T extends Record<string, number>>(
  weights: T
): keyof T {
  const entries = Object.entries(weights) as [keyof T, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  const rand = Math.random() * total

  let acc = 0
  for (const [key, weight] of entries) {
    acc += weight
    if (rand <= acc) return key
  }

  return entries[entries.length - 1][0]
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function fakeDiscordSnowflake(): string {
  const epochMs = BigInt(Date.now() - 1_420_070_400_000)
  const worker = BigInt(Math.floor(Math.random() * 32))
  const process = BigInt(Math.floor(Math.random() * 32))
  const increment = BigInt(Math.floor(Math.random() * 4096))
  return (
    (epochMs << BigInt(22)) +
    (worker << BigInt(17)) +
    (process << BigInt(12)) +
    increment
  ).toString()
}

function pickChipAmount(maxAmount: number): number {
  const chips = BET_CHIPS.filter((c) => c <= maxAmount)
  if (chips.length === 0) {
    return Math.max(1, randomInt(1, maxAmount))
  }

  const index = Math.min(
    chips.length - 1,
    Math.floor(Math.pow(Math.random(), 1.8) * chips.length)
  )
  return chips[index]
}

/** Skews timestamps toward recent days and evening hours (UTC). */
function randomCreatedAt(days: number, after?: Date): Date {
  const dayOffsetMs = Math.pow(Math.random(), 1.6) * days * 24 * 60 * 60 * 1000
  const base = new Date(Date.now() - dayOffsetMs)

  const hour = randomInt(0, 23)
  const isPeak = hour >= 17 && hour <= 23
  const adjustedHour = isPeak || Math.random() < 0.35 ? hour : randomInt(8, 16)

  base.setUTCHours(adjustedHour, randomInt(0, 59), randomInt(0, 59), 0)

  if (after) {
    const gapSec = randomInt(1, 90)
    return new Date(Math.max(after.getTime() + gapSec * 1000, base.getTime()))
  }

  return base
}

function buildUserPicker(userIds: string[]) {
  const weights = userIds.map((_, i) => 1 / Math.pow(i + 1, 0.65))
  const total = weights.reduce((s, w) => s + w, 0)

  return () => {
    let r = Math.random() * total
    for (let i = 0; i < userIds.length; i++) {
      r -= weights[i]
      if (r <= 0) return userIds[i]
    }
    return userIds[userIds.length - 1]
  }
}

async function resolveSimPools({
  guildId,
  uniqueUsers,
  useGuildUsers,
  fetchMemberIds,
  getAdminIds
}: {
  guildId: string
  uniqueUsers: number
  useGuildUsers: boolean
  fetchMemberIds: () => Promise<string[]>
  getAdminIds: () => string[]
}): Promise<{ userIds: string[]; adminIds: string[] }> {
  let userIds: string[] = []

  if (useGuildUsers) {
    userIds = await getGuildUserIds({ guildId })

    if (userIds.length < uniqueUsers) {
      try {
        userIds = [...new Set([...userIds, ...(await fetchMemberIds())])]
      } catch {
        // Large guild fetch may fail; keep DB users only.
      }
    }
  }

  while (userIds.length < uniqueUsers) {
    userIds.push(fakeDiscordSnowflake())
  }

  if (userIds.length > uniqueUsers) {
    userIds = [...userIds].sort(() => Math.random() - 0.5).slice(0, uniqueUsers)
  }

  let adminIds = getAdminIds()
  if (adminIds.length === 0) {
    adminIds = userIds.slice(0, Math.min(5, userIds.length))
  }

  return { userIds, adminIds }
}

function pickWinAmount(betAmount: number, maxAmount: number): number {
  const roll = Math.random()
  let multiplier: number

  if (roll < 0.55) {
    multiplier = randomChoice([1, 1.25, 1.5, 2, 2.5, 3])
  } else if (roll < 0.9) {
    multiplier = randomChoice([3, 4, 5, 6, 8, 10])
  } else {
    multiplier = randomChoice([12, 15, 20, 25, 50])
  }

  return Math.min(maxAmount, Math.max(1, Math.round(betAmount * multiplier)))
}

function randomCasinoGame(): CasinoGameId {
  return randomChoice(CASINO_GAME_IDS)
}

function createCasinoRound({
  guildId,
  pickUser,
  maxAmount,
  days
}: {
  guildId: string
  pickUser: () => string
  maxAmount: number
  days: number
}): SimTransaction[] {
  const userId = pickUser()
  const betId = generateId()
  const betAmount = pickChipAmount(maxAmount)
  const betAt = randomCreatedAt(days)
  const game = randomCasinoGame()

  const txs: SimTransaction[] = [
    {
      userId,
      guildId,
      amount: betAmount,
      type: 'bet',
      source: 'casino',
      referenceId: betId,
      meta: { game },
      createdAt: betAt
    }
  ]

  const outcome = Math.random()
  if (outcome < 0.52) {
    return txs
  }

  if (outcome < 0.6) {
    txs.push({
      userId,
      guildId,
      amount: betAmount,
      type: 'refund',
      source: 'casino',
      referenceId: betId,
      meta: { game },
      createdAt: randomCreatedAt(days, betAt)
    })
    return txs
  }

  txs.push({
    userId,
    guildId,
    amount: pickWinAmount(betAmount, maxAmount),
    type: 'win',
    source: 'casino',
    referenceId: betId,
    meta: { game },
    createdAt: randomCreatedAt(days, betAt)
  })

  return txs
}

function createRefundRound({
  guildId,
  pickUser,
  maxAmount,
  days
}: {
  guildId: string
  pickUser: () => string
  maxAmount: number
  days: number
}): SimTransaction[] {
  const userId = pickUser()
  const betId = generateId()
  const betAmount = pickChipAmount(maxAmount)
  const betAt = randomCreatedAt(days)
  const game = randomCasinoGame()

  return [
    {
      userId,
      guildId,
      amount: betAmount,
      type: 'bet',
      source: 'casino',
      referenceId: betId,
      meta: { game },
      createdAt: betAt
    },
    {
      userId,
      guildId,
      amount: betAmount,
      type: 'refund',
      source: 'casino',
      referenceId: betId,
      meta: { game },
      createdAt: randomCreatedAt(days, betAt)
    }
  ]
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
  const amount = pickChipAmount(
    Math.min(maxAmount, type === 'withdraw' ? 5000 : maxAmount)
  )

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
  const streak = randomInt(1, 14)
  const base = Math.min(maxAmount, Math.max(25, Math.floor(maxAmount * 0.15)))
  const amount = Math.min(
    maxAmount,
    Math.max(10, Math.round(base * (1 + (streak - 1) * 0.08)))
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
  }
): SimTransaction[] {
  switch (event) {
    case 'casino_round':
      return createCasinoRound(ctx)
    case 'refund_round':
      return createRefundRound(ctx)
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

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  try {
    const count = parseReadableStringToNumber(
      interaction.options.getString('count', true)
    )
    const maxAmount = parseReadableStringToNumber(
      interaction.options.getString('max-amount') || '1000'
    )
    const days = interaction.options.getInteger('days') ?? 30
    const uniqueUsers =
      interaction.options.getInteger('unique-users') ??
      Math.max(5, Math.floor(count / 10))
    const useGuildUsers =
      interaction.options.getBoolean('use-guild-users') ?? true

    const MAX_INPUT = 500_000
    if (count > MAX_INPUT) {
      return interaction.reply({
        content: `⚠️ Max ${MAX_INPUT} transactions at once.`
      })
    }

    if (!interaction.guild) {
      return interaction.reply({
        content: '⚠️ This command must be used in a guild.',
        ephemeral: true
      })
    }

    await interaction.deferReply()

    const guild = interaction.guild

    const { userIds, adminIds } = await resolveSimPools({
      guildId: interaction.guildId!,
      uniqueUsers,
      useGuildUsers,
      fetchMemberIds: async () => {
        const members = await guild.members.fetch({ withPresences: false })
        return [...members.keys()]
      },
      getAdminIds: () =>
        guild.members.cache
          .filter(
            (m) =>
              !m.user.bot &&
              (m.permissions.has(PermissionFlagsBits.Administrator) ||
                m.permissions.has(PermissionFlagsBits.ManageGuild))
          )
          .map((m) => m.id)
    })

    const pickUser = buildUserPicker(userIds)
    const pickAdmin = () => randomChoice(adminIds)

    const transactions: SimTransaction[] = []
    const typeCount: Record<string, number> = {}
    let casinoRounds = 0

    while (transactions.length < count) {
      const remaining = count - transactions.length
      let event = weightedRandomChoice(EVENT_WEIGHTS)

      if (
        remaining === 1 &&
        (event === 'casino_round' || event === 'refund_round')
      ) {
        event = weightedRandomChoice({
          deposit: 30,
          withdraw: 20,
          bonus: 25,
          vip: 25
        })
      }

      const batch = generateEventTransactions(event, {
        guildId: interaction.guildId!,
        pickUser,
        pickAdmin,
        maxAmount,
        days
      })

      if (event === 'casino_round' || event === 'refund_round') {
        casinoRounds++
      }

      for (const tx of batch) {
        if (transactions.length >= count) break
        transactions.push(tx)
        typeCount[tx.type] = (typeCount[tx.type] ?? 0) + 1
      }
    }

    await createMultipleTransactions(transactions)

    const summary = Object.entries(typeCount)
      .sort(([, a], [, b]) => b - a)
      .map(([type, c]) => `• **${type}**: ${formatNumberToReadableString(c)}`)
      .join('\n')

    const userSource = useGuildUsers
      ? userIds.every((id) => /^\d{17,20}$/.test(id))
        ? 'guild / DB'
        : 'mixed (guild + synthetic)'
      : 'synthetic snowflakes'

    await interaction.editReply({
      content:
        `✅ Simulated **${formatNumberToReadableString(count)}** transactions\n` +
        `👥 **${userIds.length}** users (${userSource})\n` +
        `🎰 **${formatNumberToReadableString(casinoRounds)}** casino rounds (paired bet/win/refund)\n` +
        `🗓️ Period: last **${days}** days (recent + evening bias)\n\n` +
        `**Breakdown:**\n${summary}`
    })
  } catch (error) {
    await handleUnexpectedInteractionError(interaction, error)
  }
}
