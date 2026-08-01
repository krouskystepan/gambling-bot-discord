import {
  bumpSessionStats,
  defaultCasinoSettings,
  emptySessionStats
} from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getBlackjackGameByGameId, getHiloGameByGameId, getMinesGameByGameId } from '@/services'
import { startBlackjackHand } from '@/utils/casino/blackjack'
import { startHiloRound } from '@/utils/casino/hilo'
import { startMinesBoard } from '@/utils/casino/mines'
import * as rng from '@/utils/casino/rng'
import * as bigWin from '@/utils/discord/tryAnnounceBigWin'

import { card } from '../../helpers/cards'
import { User, createTestUser, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const guildConfig = {
  globalSettings: defaultGlobalSettings,
  casinoSettings: defaultCasinoSettings
} as TGuildConfiguration

const announcingConfig = {
  ...guildConfig,
  casinoSettings: {
    ...guildConfig.casinoSettings,
    winAnnouncements: {
      ...guildConfig.casinoSettings.winAnnouncements,
      blackjackMinMultiplier: 1
    }
  }
} as TGuildConfiguration

const quietConfig = {
  ...guildConfig,
  casinoSettings: {
    ...guildConfig.casinoSettings,
    winAnnouncements: {
      ...guildConfig.casinoSettings.winAnnouncements,
      blackjackMinMultiplier: 100
    }
  }
} as TGuildConfiguration

/** First two cards go to the player, next two to the dealer. */
const stackDeck = (...cards: ReturnType<typeof card>[]) => {
  vi.spyOn(rng, 'shuffleDeck').mockReturnValue([
    ...cards,
    card('2', 2),
    card('3', 3),
    card('4', 4),
    card('5', 5)
  ])
}

const dealHand = ({
  config = guildConfig,
  gameId = 'bj-session-1',
  sessionStats
}: {
  config?: TGuildConfiguration
  gameId?: string
  sessionStats?: ReturnType<typeof emptySessionStats>
} = {}) =>
  startBlackjackHand({
    userId: 'user-1',
    guildId: 'guild-1',
    gameId,
    channelId: 'channel-1',
    messageId: 'msg-1',
    betAmount: 100,
    showBalance: true,
    sessionStats,
    guildConfig: config,
    guild: null,
    sourceChannelId: 'channel-1'
  })

describe('startBlackjackHand', () => {
  afterEach(() => vi.restoreAllMocks())

  it('deals a live hand and reserves the stake', async () => {
    await createTestUser({ balance: 1000 })
    stackDeck(card('10', 10), card('7', 7), card('9', 9), card('6', 6))

    const result = await dealHand()

    expect(result.phase).toBe('PLAYER')
    expect(result.components).toHaveLength(1)

    const game = await getBlackjackGameByGameId({
      gameId: 'bj-session-1',
      guildId: 'guild-1'
    })
    expect(game?.phase).toBe('PLAYER')
    expect(game?.activeBetId).toBeTruthy()
    expect(game?.baseBetAmount).toBe(100)
    expect(game?.sessionStats.roundsPlayed).toBe(0)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(900)
    expect(user?.lockedBalance).toBe(100)
  })

  it('offers split when the opening cards match', async () => {
    await createTestUser({ balance: 1000 })
    stackDeck(card('8', 8), card('8', 8), card('9', 9), card('6', 6))

    const result = await dealHand()

    const buttons = result.components[0] as {
      components: { data: { custom_id: string; disabled?: boolean } }[]
    }
    const split = buttons.components.find((b) =>
      b.data.custom_id.endsWith('SPLIT:1')
    )
    expect(split?.data.disabled).toBeFalsy()
  })

  it('settles a natural blackjack into RESULT and announces it', async () => {
    await createTestUser({ balance: 1000 })
    const announce = vi
      .spyOn(bigWin, 'tryAnnounceBigWin')
      .mockImplementation(() => undefined)
    stackDeck(card('A', 11), card('10', 10), card('9', 9), card('6', 6))

    const result = await dealHand({ config: announcingConfig })

    expect(result.phase).toBe('RESULT')
    expect(announce).toHaveBeenCalledTimes(1)

    const game = await getBlackjackGameByGameId({
      gameId: 'bj-session-1',
      guildId: 'guild-1'
    })
    expect(game?.phase).toBe('RESULT')
    expect(game?.activeBetId).toBeNull()
    expect(game?.sessionStats.roundsPlayed).toBe(1)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBeGreaterThan(1000)
  })

  it('skips the announcement when the multiplier is below the threshold', async () => {
    await createTestUser({ balance: 1000 })
    const announce = vi
      .spyOn(bigWin, 'tryAnnounceBigWin')
      .mockImplementation(() => undefined)
    stackDeck(card('A', 11), card('10', 10), card('9', 9), card('6', 6))

    await dealHand({ config: quietConfig })

    expect(announce).not.toHaveBeenCalled()
  })

  it('settles a dealer blackjack as a loss', async () => {
    await createTestUser({ balance: 1000 })
    stackDeck(card('10', 10), card('7', 7), card('A', 11), card('10', 10))

    const result = await dealHand()

    expect(result.phase).toBe('RESULT')

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(900)
    expect(user?.lockedBalance).toBe(0)
  })

  it('pushes when both sides have blackjack and keeps prior stats', async () => {
    await createTestUser({ balance: 1000 })
    stackDeck(card('A', 11), card('10', 10), card('A', 11), card('10', 10))

    const result = await dealHand({
      sessionStats: bumpSessionStats(emptySessionStats(), {
        totalBet: 50,
        totalPayout: 50
      })
    })

    expect(result.phase).toBe('RESULT')

    const game = await getBlackjackGameByGameId({
      gameId: 'bj-session-1',
      guildId: 'guild-1'
    })
    expect(game?.sessionStats.roundsPlayed).toBe(2)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(1000)
    expect(user?.lockedBalance).toBe(0)
  })
})

describe('startMinesBoard', () => {
  it('reserves the stake and persists an active board', async () => {
    await createTestUser({ balance: 1000 })

    const result = await startMinesBoard({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'mines-session-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      mineCount: 3,
      houseEdge: 0.03,
      showBalance: false,
      globalSettings: defaultGlobalSettings
    })

    expect(result.embeds).toHaveLength(1)
    expect(result.components.length).toBeGreaterThan(0)

    const game = await getMinesGameByGameId({
      gameId: 'mines-session-1',
      guildId: 'guild-1'
    })
    expect(game?.status).toBe('ACTIVE')
    expect(game?.activeBetId).toBeTruthy()
    expect(game?.mineIndices).toHaveLength(3)
    expect(game?.sessionStats.roundsPlayed).toBe(0)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(900)
    expect(user?.lockedBalance).toBe(100)
  })

  it('carries prior session stats onto the new board', async () => {
    await createTestUser({ balance: 1000 })

    await startMinesBoard({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'mines-session-2',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      mineCount: 5,
      houseEdge: 0.03,
      showBalance: true,
      sessionStats: bumpSessionStats(emptySessionStats(), {
        totalBet: 100,
        totalPayout: 0
      }),
      globalSettings: defaultGlobalSettings
    })

    const game = await getMinesGameByGameId({
      gameId: 'mines-session-2',
      guildId: 'guild-1'
    })
    expect(game?.sessionStats).toMatchObject({
      roundsPlayed: 1,
      totalWagered: 100,
      netProfit: -100
    })
    expect(game?.showBalance).toBe(true)
  })
})

describe('startHiloRound', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reserves the stake and persists a waiting round', async () => {
    await createTestUser({ balance: 1000 })
    vi.spyOn(rng, 'createShuffledHiloDeck').mockReturnValue([
      { label: 'A', suite: '♠️', rank: 14 },
      { label: '7', suite: '♥️', rank: 7 }
    ])

    const result = await startHiloRound({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'hilo-session-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      houseEdge: 0.03,
      showBalance: false,
      globalSettings: defaultGlobalSettings
    })

    expect(result.embeds).toHaveLength(1)
    expect(result.components).toHaveLength(1)

    const game = await getHiloGameByGameId({
      gameId: 'hilo-session-1',
      guildId: 'guild-1'
    })
    expect(game?.status).toBe('WAITING')
    expect(game?.activeBetId).toBeTruthy()
    expect(game?.betAmount).toBe(100)
    expect(game?.firstCard?.rank).toBe(7)
    expect(game?.sessionStats.roundsPlayed).toBe(0)

    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(900)
    expect(user?.lockedBalance).toBe(100)
  })

  it('carries prior session stats onto the new round', async () => {
    await createTestUser({ balance: 1000 })
    vi.spyOn(rng, 'createShuffledHiloDeck').mockReturnValue([
      { label: '2', suite: '♦️', rank: 2 },
      { label: 'K', suite: '♣️', rank: 13 }
    ])

    await startHiloRound({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'hilo-session-2',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      houseEdge: 0.03,
      showBalance: true,
      sessionStats: bumpSessionStats(emptySessionStats(), {
        totalBet: 100,
        totalPayout: 0
      }),
      globalSettings: defaultGlobalSettings
    })

    const game = await getHiloGameByGameId({
      gameId: 'hilo-session-2',
      guildId: 'guild-1'
    })
    expect(game?.sessionStats).toMatchObject({
      roundsPlayed: 1,
      totalWagered: 100,
      netProfit: -100
    })
    expect(game?.showBalance).toBe(true)
    expect(game?.activeBetId).toContain('hilo-session-2')
  })
})
