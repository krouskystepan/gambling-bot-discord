import {
  defaultCasinoSettings,
  emptySessionStats
} from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { describe, expect, it, vi } from 'vitest'

import {
  getBaccaratGameByGameId,
  getBlackjackGameByGameId,
  getMinesGameByGameId,
  getPlinkoGameByGameId,
  getRouletteGameByGameId,
  getSlotsGameByGameId,
  reserveCasinoBet,
  upsertBaccaratGame,
  upsertBlackjackGame,
  upsertMinesGame,
  upsertPlinkoGame,
  upsertRouletteGame,
  upsertSlotsGame
} from '@/services'
import { recoverBaccaratDeal } from '@/utils/casino/baccarat/playRound'
import { finishBlackjackDealerAndSettle } from '@/utils/casino/blackjack'
import { finishMinesAndSettle } from '@/utils/casino/mines'
import { recoverPlinkoBatch } from '@/utils/casino/plinko'
import { recoverRouletteSpin } from '@/utils/casino/roulette/playRound'
import { recoverSlotsBatch } from '@/utils/casino/slots'

import { card } from '../../helpers/cards'
import { User, createTestUser, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

const guildConfig = {
  globalSettings: defaultGlobalSettings,
  casinoSettings: defaultCasinoSettings
} as TGuildConfiguration

describe('in-flight casino recovery helpers', () => {
  it('settles a stale roulette spin from pending result', async () => {
    await createTestUser({ balance: 1000 })
    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      betId: 'roulette-stale-1',
      game: 'roulette'
    })
    await upsertRouletteGame({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      gameId: 'roulette-game-1',
      showBalance: false,
      skipAnimations: false,
      phase: 'spinning',
      bets: [
        {
          amount: 100,
          type: 'color',
          value: 'red',
          displayValue: 'Red'
        }
      ],
      activeBetId: 'roulette-stale-1',
      lockedAmount: 100,
      pendingSpinResult: '1'
    })

    const message = {
      edit: vi.fn().mockResolvedValue(undefined)
    }

    await recoverRouletteSpin({
      message: message as never,
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'roulette-game-1',
      bets: [
        {
          amount: 100,
          type: 'color',
          value: 'red',
          displayValue: 'Red'
        }
      ],
      spinResult: '1',
      showBalance: false,
      guild: null,
      guildConfig,
      sourceChannelId: 'channel-1',
      betId: 'roulette-stale-1'
    })

    const game = await getRouletteGameByGameId({
      gameId: 'roulette-game-1',
      guildId: 'guild-1'
    })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    expect(message.edit).toHaveBeenCalled()
    expect(game?.phase).toBe('result')
    expect(game?.pendingSpinResult).toBeNull()
    expect(game?.lastSpinResult).toBe('1')
    expect(game?.activeBetId).toBeNull()
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBeGreaterThan(900)
  })

  it('settles an all-bust blackjack dealer phase into RESULT', async () => {
    await createTestUser({ balance: 1000 })
    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      betId: 'blackjack-stale-1',
      game: 'blackjack'
    })
    const game = await upsertBlackjackGame({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      gameId: 'blackjack-game-1',
      activeBetId: 'blackjack-stale-1',
      baseBetAmount: 100,
      showBalance: false,
      deck: [],
      deckIndex: 0,
      hands: [
        {
          cards: [card('10', 10), card('9', 9), card('5', 5)],
          betAmount: 100,
          finished: true,
          isSplitHand: false
        }
      ],
      activeHandIndex: 0,
      phase: 'DEALER',
      dealerCards: [card('10', 10), card('7', 7)]
    })

    const result = await finishBlackjackDealerAndSettle({
      game: game!,
      engine: {
        deck: game!.deck,
        deckIndex: game!.deckIndex,
        hands: game!.hands,
        activeHandIndex: game!.activeHandIndex,
        phase: game!.phase,
        dealerCards: game!.dealerCards
      },
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    const settled = await getBlackjackGameByGameId({
      gameId: 'blackjack-game-1',
      guildId: 'guild-1'
    })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    expect(result.finalResultId).toBe('LOSS')
    expect(settled?.phase).toBe('RESULT')
    expect(settled?.activeBetId).toBeNull()
    expect(settled?.sessionStats.roundsPlayed).toBe(1)
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBe(900)
  })

  it('settles a stale baccarat deal from pending cards', async () => {
    await createTestUser({ balance: 1000 })
    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      betId: 'baccarat-stale-1',
      game: 'baccarat'
    })
    await upsertBaccaratGame({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      gameId: 'baccarat-game-1',
      activeBetId: 'baccarat-stale-1',
      bets: [{ side: 'player', amount: 100 }],
      lockedAmount: 100,
      showBalance: false,
      skipAnimations: false,
      phase: 'dealing',
      pendingDeal: {
        playerCards: [
          { label: '9', suite: '♠️' },
          { label: '9', suite: '♥️' }
        ],
        bankerCards: [
          { label: '2', suite: '♣️' },
          { label: '5', suite: '♦️' }
        ]
      }
    })

    const message = {
      edit: vi.fn().mockResolvedValue(undefined)
    }

    const settled = await recoverBaccaratDeal({
      message: message as never,
      playerCards: [
        { label: '9', suite: '♠️' },
        { label: '9', suite: '♥️' }
      ],
      bankerCards: [
        { label: '2', suite: '♣️' },
        { label: '5', suite: '♦️' }
      ],
      bets: [{ side: 'player', amount: 100 }],
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'baccarat-game-1',
      betId: 'baccarat-stale-1',
      showBalance: false,
      baccaratSettings: guildConfig.casinoSettings.baccarat,
      globalSettings: guildConfig.globalSettings,
      guild: null,
      guildConfig,
      sourceChannelId: 'channel-1'
    })

    const game = await getBaccaratGameByGameId({
      gameId: 'baccarat-game-1',
      guildId: 'guild-1'
    })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    expect(message.edit).toHaveBeenCalled()
    expect(settled.slip.lines[0]?.won).toBe(true)
    expect(game?.phase).toBe('result')
    expect(game?.activeBetId).toBeNull()
    expect(game?.lastBets).toMatchObject([{ side: 'player', amount: 100 }])
    expect(game?.bets).toMatchObject([])
    expect(game?.pendingDeal).toBeNull()
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBeGreaterThan(1000)
  })

  it('settles a stale slots batch from pending results', async () => {
    await createTestUser({ balance: 1000 })
    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 200,
      betId: 'slots-stale-1',
      game: 'slots'
    })
    await upsertSlotsGame({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      gameId: 'slots-game-1',
      showBalance: false,
      skipAnimations: true,
      unitBet: 100,
      spinsCount: 2,
      phase: 'spinning',
      pendingBatchResults: ['🍒🍒🍒', '🍒🫐🍉'],
      activeBetId: 'slots-stale-1',
      lockedAmount: 200
    })

    const message = {
      edit: vi.fn().mockResolvedValue(undefined)
    }

    const settled = await recoverSlotsBatch({
      message: message as never,
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'slots-game-1',
      unitBet: 100,
      spinsCount: 2,
      spinResults: ['🍒🍒🍒', '🍒🫐🍉'],
      showBalance: false,
      guild: null,
      guildConfig,
      sourceChannelId: 'channel-1',
      betId: 'slots-stale-1'
    })

    const game = await getSlotsGameByGameId({
      gameId: 'slots-game-1',
      guildId: 'guild-1'
    })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    expect(message.edit).toHaveBeenCalled()
    expect(settled.net).toBe(300)
    expect(game?.phase).toBe('result')
    expect(game?.pendingBatchResults).toBeNull()
    expect(game?.activeBetId).toBeNull()
    expect(game?.lastWinsCount).toBe(1)
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBe(1300)
  })

  it('settles a stale plinko batch from pending paths', async () => {
    await createTestUser({ balance: 1000 })
    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 200,
      betId: 'plinko-stale-1',
      game: 'plinko'
    })

    // Final path index 0 -> bin 1 (edge, typically high mult in defaults).
    // Use short paths with final indexes that map cleanly for settle math.
    const paths = [
      [0, 0, 0],
      [0, 1, 4]
    ]

    await upsertPlinkoGame({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      gameId: 'plinko-game-1',
      showBalance: false,
      skipAnimations: true,
      unitBet: 100,
      ballsCount: 2,
      phase: 'dropping',
      pendingBatchResults: paths,
      activeBetId: 'plinko-stale-1',
      lockedAmount: 200
    })

    const message = {
      edit: vi.fn().mockResolvedValue(undefined)
    }

    const settled = await recoverPlinkoBatch({
      message: message as never,
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'plinko-game-1',
      unitBet: 100,
      ballsCount: 2,
      paths,
      showBalance: false,
      guild: null,
      guildConfig,
      sourceChannelId: 'channel-1',
      betId: 'plinko-stale-1'
    })

    const game = await getPlinkoGameByGameId({
      gameId: 'plinko-game-1',
      guildId: 'guild-1'
    })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    expect(message.edit).toHaveBeenCalled()
    expect(game?.phase).toBe('result')
    expect(game?.pendingBatchResults).toBeNull()
    expect(game?.activeBetId).toBeNull()
    expect(game?.lockedAmount).toBeNull()
    expect(typeof settled.net).toBe('number')
    expect(user?.lockedBalance).toBe(0)
  })

  it('settles a mines board stuck mid-settlement', async () => {
    await createTestUser({ balance: 1000 })
    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      betId: 'mines-stale-1',
      game: 'mines'
    })
    await upsertMinesGame({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      gameId: 'mines-game-1',
      activeBetId: 'mines-stale-1',
      betAmount: 100,
      mineCount: 3,
      mineIndices: [0, 1, 2],
      revealedIndices: [0],
      houseEdgeSnapshot: 0.03,
      status: 'RESULT'
    })

    const message = {
      edit: vi.fn().mockResolvedValue(undefined)
    }

    const resolved = await finishMinesAndSettle({
      game: {
        userId: 'user-1',
        guildId: 'guild-1',
        channelId: 'channel-1',
        messageId: 'msg-1',
        gameId: 'mines-game-1',
        activeBetId: 'mines-stale-1',
        betAmount: 100,
        mineCount: 3,
        mineIndices: [0, 1, 2],
        revealedIndices: [0],
        houseEdgeSnapshot: 0.03,
        status: 'RESULT',
        showBalance: false,
        sessionStats: emptySessionStats(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false,
      message: message as never
    })

    const settled = await getMinesGameByGameId({
      gameId: 'mines-game-1',
      guildId: 'guild-1'
    })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    expect(message.edit).toHaveBeenCalled()
    expect(resolved.resultKind).toBe('BUST')
    expect(settled?.status).toBe('RESULT')
    expect(settled?.activeBetId).toBeNull()
    expect(settled?.sessionStats.roundsPlayed).toBe(1)
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBe(900)
  })

  it('settles a finished mines cash-out with balance display', async () => {
    await createTestUser({ balance: 1000 })
    await reserveCasinoBet({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 100,
      betId: 'mines-stale-cashout',
      game: 'mines'
    })
    await upsertMinesGame({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      gameId: 'mines-game-cashout',
      activeBetId: 'mines-stale-cashout',
      betAmount: 100,
      mineCount: 3,
      mineIndices: [0, 1, 2],
      revealedIndices: [5, 6],
      houseEdgeSnapshot: 0.03,
      status: 'RESULT'
    })

    const message = {
      edit: vi.fn().mockResolvedValue(undefined)
    }

    const announceConfig = {
      ...guildConfig,
      casinoSettings: {
        ...guildConfig.casinoSettings,
        winAnnouncements: {
          ...guildConfig.casinoSettings.winAnnouncements,
          minesMinMultiplier: 1
        }
      }
    } as TGuildConfiguration

    const resolved = await finishMinesAndSettle({
      game: {
        userId: 'user-1',
        guildId: 'guild-1',
        channelId: 'channel-1',
        messageId: 'msg-1',
        gameId: 'mines-game-cashout',
        activeBetId: 'mines-stale-cashout',
        betAmount: 100,
        mineCount: 3,
        mineIndices: [0, 1, 2],
        revealedIndices: [5, 6],
        houseEdgeSnapshot: 0.03,
        status: 'RESULT',
        showBalance: false,
        sessionStats: emptySessionStats(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      guildConfig: announceConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } } as never,
      sourceChannelId: 'channel-1',
      showBalance: true,
      message: message as never
    })

    const settled = await getMinesGameByGameId({
      gameId: 'mines-game-cashout',
      guildId: 'guild-1'
    })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    expect(message.edit).toHaveBeenCalled()
    expect(resolved.resultKind).toBe('CASH_OUT')
    expect(resolved.payout).toBeGreaterThan(100)
    expect(settled?.status).toBe('RESULT')
    expect(settled?.activeBetId).toBeNull()
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBeGreaterThan(1000)
  })
})
