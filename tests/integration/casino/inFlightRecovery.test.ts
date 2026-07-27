import { defaultCasinoSettings } from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { describe, expect, it, vi } from 'vitest'

import {
  deleteBaccaratGame,
  getBaccaratGameByBetId,
  getBlackjackGameByBetId,
  getRouletteGameByGameId,
  reserveCasinoBet,
  upsertBaccaratGame,
  upsertBlackjackGame,
  upsertRouletteGame
} from '@/services'
import { finishBlackjackDealerAndSettle } from '@/utils/casino/blackjack'
import { recoverBaccaratDeal } from '@/utils/casino/baccarat/playRound'
import { recoverRouletteSpin } from '@/utils/casino/roulette/playRound'

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

  it('settles and deletes an all-bust blackjack dealer phase', async () => {
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
      betId: 'blackjack-stale-1',
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

    const remaining = await getBlackjackGameByBetId({
      betId: 'blackjack-stale-1',
      guildId: 'guild-1'
    })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    expect(result.finalResultId).toBe('LOSS')
    expect(remaining).toBeNull()
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
      betId: 'baccarat-stale-1',
      betAmount: 100,
      showBalance: false,
      skipAnimations: false,
      phase: 'dealing',
      pendingDeal: {
        side: 'player',
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
      side: 'player',
      playerCards: [
        { label: '9', suite: '♠️' },
        { label: '9', suite: '♥️' }
      ],
      bankerCards: [
        { label: '2', suite: '♣️' },
        { label: '5', suite: '♦️' }
      ],
      userId: 'user-1',
      guildId: 'guild-1',
      betId: 'baccarat-stale-1',
      betAmount: 100,
      showBalance: false,
      winMultipliers: guildConfig.casinoSettings.baccarat.winMultipliers,
      globalSettings: guildConfig.globalSettings,
      guild: null,
      guildConfig,
      sourceChannelId: 'channel-1'
    })

    await deleteBaccaratGame({ userId: 'user-1', guildId: 'guild-1' })

    const remaining = await getBaccaratGameByBetId({
      betId: 'baccarat-stale-1',
      guildId: 'guild-1'
    })
    const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })

    expect(message.edit).toHaveBeenCalled()
    expect(settled.resolution.won).toBe(true)
    expect(remaining).toBeNull()
    expect(user?.lockedBalance).toBe(0)
    expect(user?.balance).toBeGreaterThan(1000)
  })
})
