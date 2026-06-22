import type { CasinoGameId, TCasinoSettings } from 'gambling-bot-shared/casino'

export type MockScale = 'small' | 'medium' | 'large'

export type MockScalePreset = {
  users: number
  transactions: number
  atmRequests: number
  raffles: number
  predictions: number
  vipRooms: number
  days: number
}

export const MOCK_SCALE_PRESETS: Record<MockScale, MockScalePreset> = {
  small: {
    users: 30,
    transactions: 800,
    atmRequests: 20,
    raffles: 4,
    predictions: 6,
    vipRooms: 5,
    days: 14
  },
  medium: {
    users: 80,
    transactions: 4_000,
    atmRequests: 50,
    raffles: 8,
    predictions: 14,
    vipRooms: 12,
    days: 30
  },
  large: {
    users: 200,
    transactions: 20_000,
    atmRequests: 120,
    raffles: 15,
    predictions: 30,
    vipRooms: 25,
    days: 60
  }
}

/** All casino games included in mock transaction generation. */
export const MOCK_CASINO_GAME_IDS = [
  'slots',
  'dice',
  'coinflip',
  'roulette',
  'plinko',
  'lottery',
  'goldenJackpot',
  'blackjack',
  'rps',
  'prediction',
  'raffle'
] as const satisfies readonly CasinoGameId[]

export type MockCasinoGameId = (typeof MOCK_CASINO_GAME_IDS)[number]

/** Popularity weights — slots/dice dominate; niche games are rarer. */
export const CASINO_GAME_WEIGHTS: Record<MockCasinoGameId, number> = {
  slots: 22,
  dice: 14,
  coinflip: 11,
  roulette: 9,
  plinko: 7,
  blackjack: 8,
  lottery: 4,
  goldenJackpot: 3,
  rps: 6,
  prediction: 8,
  raffle: 8
}

export const BET_CHIPS = [
  10, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 2500, 5000, 10_000
]

export const VIP_ADMIN_ACTIONS = [
  'admin-buy',
  'admin-extend',
  'admin-add-member'
] as const

export const EVENT_WEIGHTS = {
  casino_round: 60,
  deposit: 16,
  withdraw: 7,
  bonus: 5,
  vip: 4
} as const

export const PREDICTION_TITLES = [
  'Will BTC close above $100k this week?',
  'Who wins the championship finals?',
  'Total goals over 2.5 in the match?',
  'Will it rain on event day?',
  'Next album release before summer?',
  'Highest grossing movie this month?',
  'Esports MVP — Player A or Player B?',
  'Stock index up or down Friday close?'
]

export const PREDICTION_CHOICE_SETS = [
  ['Yes', 'No'],
  ['Team Alpha', 'Team Beta', 'Draw'],
  ['Over 2.5', 'Under 2.5'],
  ['Player A', 'Player B'],
  ['Up', 'Down', 'Flat']
]

export function randomAtmAccount(): string {
  const roll = Math.random()

  if (roll < 0.5) {
    return Array.from({ length: randomInt(8, 12) }, () =>
      Math.floor(Math.random() * 10)
    ).join('')
  }

  if (roll < 0.8) {
    const prefix = randomChoice(['CZ', 'SK', 'DE', 'GB', 'AT'])
    return `${prefix}${Array.from({ length: 20 }, () =>
      Math.floor(Math.random() * 10)
    ).join('')}`
  }

  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('')
  ).join(' ')
}

export function weightedRandomChoice<T extends Record<string, number>>(
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

export function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function fakeDiscordSnowflake(): string {
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

export function fakeChannelId(): string {
  return fakeDiscordSnowflake()
}

export function pickChipAmount(maxAmount: number, minAmount = 1): number {
  const chips = BET_CHIPS.filter((c) => c >= minAmount && c <= maxAmount)
  if (chips.length === 0) {
    return Math.max(minAmount, randomInt(minAmount, maxAmount))
  }

  const index = Math.min(
    chips.length - 1,
    Math.floor(Math.pow(Math.random(), 1.8) * chips.length)
  )
  return chips[index]
}

export function pickBetAmountForGame(
  casinoSettings: TCasinoSettings,
  game: MockCasinoGameId,
  fallbackMax: number
): number {
  const settings = casinoSettings[game] as { minBet?: number; maxBet?: number }
  const minBet = Math.max(1, settings?.minBet ?? 10)
  const configuredMax =
    settings?.maxBet != null && settings.maxBet > 0
      ? settings.maxBet
      : fallbackMax
  const maxBet = Math.max(minBet, Math.min(configuredMax, fallbackMax))

  return pickChipAmount(maxBet, minBet)
}

export function pickOpponentUser(
  userIds: string[],
  excludeUserId: string
): string {
  const pool = userIds.filter((id) => id !== excludeUserId)
  if (pool.length === 0) return excludeUserId
  return randomChoice(pool)
}

/** Skews timestamps toward recent days and evening hours (UTC). */
export function randomCreatedAt(days: number, after?: Date): Date {
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

export function buildUserPicker(userIds: string[]) {
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

export function randomMockCasinoGame(): MockCasinoGameId {
  return weightedRandomChoice(CASINO_GAME_WEIGHTS)
}

export function randomCasinoGame(): MockCasinoGameId {
  return randomMockCasinoGame()
}

export type MockUserPools = {
  userIds: string[]
  adminIds: string[]
  pickUser: () => string
  pickAdmin: () => string
}

export async function resolveMockUserPools({
  guildId,
  userCount,
  invokingUserId,
  useGuildUsers,
  fetchMemberIds,
  getAdminIds
}: {
  guildId: string
  userCount: number
  invokingUserId: string
  useGuildUsers: boolean
  fetchMemberIds: () => Promise<string[]>
  getAdminIds: () => string[]
}): Promise<MockUserPools> {
  let userIds: string[] = [invokingUserId]

  if (useGuildUsers) {
    const { getGuildUserIds } = await import('@/services/db/user.db')
    userIds = [
      ...new Set([invokingUserId, ...(await getGuildUserIds({ guildId }))])
    ]

    if (userIds.length < userCount) {
      try {
        userIds = [...new Set([...userIds, ...(await fetchMemberIds())])]
      } catch {
        // Large guild fetch may fail; keep existing pool.
      }
    }
  }

  while (userIds.length < userCount) {
    userIds.push(fakeDiscordSnowflake())
  }

  if (userIds.length > userCount) {
    userIds = [...userIds]
      .sort((a, b) => {
        if (a === invokingUserId) return -1
        if (b === invokingUserId) return 1
        return Math.random() - 0.5
      })
      .slice(0, userCount)
  }

  let adminIds = getAdminIds()
  if (adminIds.length === 0) {
    adminIds = [
      invokingUserId,
      ...userIds.slice(0, Math.min(4, userIds.length))
    ]
  }

  return {
    userIds,
    adminIds,
    pickUser: buildUserPicker(userIds),
    pickAdmin: () => randomChoice(adminIds)
  }
}

export function parseMockScale(value: string | null): MockScale {
  if (value === 'medium' || value === 'large') return value
  return 'small'
}
