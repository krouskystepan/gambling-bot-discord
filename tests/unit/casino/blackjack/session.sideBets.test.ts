import type { Card } from 'gambling-bot-shared/blackjack'
import {
  defaultCasinoSettings,
  emptySessionStats
} from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as services from '@/services'
import { startBlackjackHand } from '@/utils/casino/blackjack/session'
import * as rng from '@/utils/casino/rng'

const guildConfig = {
  globalSettings: defaultGlobalSettings,
  casinoSettings: defaultCasinoSettings
} as TGuildConfiguration

const card = (
  label: Card['label'],
  suite: Card['suite'],
  value: number
): Card => ({ label, suite, value })

describe('startBlackjackHand side bets', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(services, 'reserveCasinoBet').mockResolvedValue(undefined as never)
    vi.spyOn(services, 'settleCasinoWinnings').mockResolvedValue(500)
    vi.spyOn(services, 'upsertBlackjackGame').mockResolvedValue(null as never)
  })

  it('reserves main + pairs and enters INSURANCE on Ace up', async () => {
    vi.spyOn(rng, 'shuffleDeck').mockReturnValue([
      card('K', '♠️', 10),
      card('K', '♥️', 10),
      card('A', '♦️', 11),
      card('9', '♣️', 9),
      ...Array.from({ length: 48 }, () => card('2', '♠️', 2))
    ])

    const result = await startBlackjackHand({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'game-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      pairsBetAmount: 20,
      showBalance: false,
      sessionStats: emptySessionStats(),
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1'
    })

    expect(services.reserveCasinoBet).toHaveBeenCalledWith(
      expect.objectContaining({
        totalBet: 120,
        game: 'blackjack'
      })
    )
    expect(result.phase).toBe('INSURANCE')
    expect(services.upsertBlackjackGame).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'INSURANCE',
        activePairsBetAmount: 20,
        pairsOutcome: 'mixed',
        insuranceBetAmount: null
      })
    )
  })

  it('reserves main + 21+3 and stores plusThree outcome at deal', async () => {
    vi.spyOn(rng, 'shuffleDeck').mockReturnValue([
      card('7', '♥️', 7),
      card('8', '♥️', 8),
      card('9', '♥️', 9),
      card('2', '♣️', 2),
      ...Array.from({ length: 48 }, () => card('2', '♠️', 2))
    ])

    const result = await startBlackjackHand({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'game-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      plusThreeBetAmount: 15,
      showBalance: false,
      sessionStats: emptySessionStats(),
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1'
    })

    expect(services.reserveCasinoBet).toHaveBeenCalledWith(
      expect.objectContaining({
        totalBet: 115,
        game: 'blackjack'
      })
    )
    expect(result.phase).toBe('PLAYER')
    expect(services.upsertBlackjackGame).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'PLAYER',
        activePlusThreeBetAmount: 15,
        plusThreeOutcome: 'straightFlush'
      })
    )
  })

  it('keeps 21+3 stake through Ace-up insurance offer', async () => {
    vi.spyOn(rng, 'shuffleDeck').mockReturnValue([
      card('9', '♠️', 9),
      card('8', '♥️', 8),
      card('A', '♦️', 11),
      card('7', '♣️', 7),
      ...Array.from({ length: 48 }, () => card('2', '♠️', 2))
    ])

    const result = await startBlackjackHand({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'game-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      plusThreeBetAmount: 20,
      showBalance: false,
      sessionStats: emptySessionStats(),
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1'
    })

    expect(result.phase).toBe('INSURANCE')
    expect(services.upsertBlackjackGame).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'INSURANCE',
        activePlusThreeBetAmount: 20,
        plusThreeOutcome: 'loss'
      })
    )
  })

  it('settles naturals including a winning 21+3 stake', async () => {
    // Player BJ + dealer non-Ace up; 21+3 is A+K+10 flush? A hearts, K hearts, 10 diamonds = loss
    // Use A+K hearts + Q hearts = flush with dealer Q up (not Ace).
    vi.spyOn(rng, 'shuffleDeck').mockReturnValue([
      card('A', '♥️', 11),
      card('K', '♥️', 10),
      card('Q', '♥️', 10),
      card('5', '♣️', 5),
      ...Array.from({ length: 48 }, () => card('2', '♠️', 2))
    ])

    const result = await startBlackjackHand({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'game-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      plusThreeBetAmount: 10,
      showBalance: false,
      sessionStats: emptySessionStats(),
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1'
    })

    expect(result.phase).toBe('RESULT')
    // A-K-Q suited is straight flush (40:1 + stake) + natural BJ
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({
        totalBet: 110,
        winnings: 660
      })
    )
    expect(services.upsertBlackjackGame).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'RESULT',
        basePlusThreeBetAmount: 10,
        activePlusThreeBetAmount: null
      })
    )
  })

  it('does not enter INSURANCE when dealer up is not Ace', async () => {
    vi.spyOn(rng, 'shuffleDeck').mockReturnValue([
      card('9', '♠️', 9),
      card('8', '♥️', 8),
      card('10', '♦️', 10),
      card('7', '♣️', 7),
      ...Array.from({ length: 48 }, () => card('2', '♠️', 2))
    ])

    const result = await startBlackjackHand({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'game-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      pairsBetAmount: 10,
      showBalance: false,
      sessionStats: emptySessionStats(),
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1'
    })

    expect(result.phase).toBe('PLAYER')
    expect(services.upsertBlackjackGame).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'PLAYER',
        activePairsBetAmount: 10
      })
    )
  })

  it('settles dealer blackjack with pairs win and no insurance', async () => {
    // Non-Ace up + hole Ace = dealer BJ without insurance offer.
    vi.spyOn(rng, 'shuffleDeck').mockReturnValue([
      card('K', '♠️', 10),
      card('K', '♠️', 10),
      card('10', '♦️', 10),
      card('A', '♣️', 11),
      ...Array.from({ length: 48 }, () => card('2', '♠️', 2))
    ])

    const result = await startBlackjackHand({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'game-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      pairsBetAmount: 10,
      showBalance: false,
      sessionStats: emptySessionStats(),
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1'
    })

    expect(result.phase).toBe('RESULT')
    // Main loss 100 + pairs perfect 260 return => total payout 260, total bet 110
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({
        totalBet: 110,
        winnings: 260
      })
    )
  })

  it('skips insurance buttons when insurance payout is 0', async () => {
    vi.spyOn(rng, 'shuffleDeck').mockReturnValue([
      card('9', '♠️', 9),
      card('8', '♥️', 8),
      card('A', '♦️', 11),
      card('7', '♣️', 7),
      ...Array.from({ length: 48 }, () => card('2', '♠️', 2))
    ])

    const result = await startBlackjackHand({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'game-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      showBalance: false,
      sessionStats: emptySessionStats(),
      guildConfig: {
        ...guildConfig,
        casinoSettings: {
          ...defaultCasinoSettings,
          blackjack: {
            ...defaultCasinoSettings.blackjack,
            winMultipliers: {
              ...defaultCasinoSettings.blackjack.winMultipliers,
              insurance: 0
            }
          }
        }
      } as TGuildConfiguration,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1'
    })

    expect(result.phase).toBe('PLAYER')
    expect(result.phase).not.toBe('INSURANCE')
  })

  it('ignores pairs / 21+3 stakes when all payouts are 0', async () => {
    vi.spyOn(rng, 'shuffleDeck').mockReturnValue([
      card('9', '♠️', 9),
      card('8', '♥️', 8),
      card('10', '♦️', 10),
      card('7', '♣️', 7),
      ...Array.from({ length: 48 }, () => card('2', '♠️', 2))
    ])

    await startBlackjackHand({
      userId: 'user-1',
      guildId: 'guild-1',
      gameId: 'game-1',
      channelId: 'channel-1',
      messageId: 'msg-1',
      betAmount: 100,
      pairsBetAmount: 25,
      plusThreeBetAmount: 25,
      showBalance: false,
      sessionStats: emptySessionStats(),
      guildConfig: {
        ...guildConfig,
        casinoSettings: {
          ...defaultCasinoSettings,
          blackjack: {
            ...defaultCasinoSettings.blackjack,
            pairsMultipliers: { perfect: 0, colored: 0, mixed: 0 },
            plusThreeMultipliers: {
              suitedTrips: 0,
              straightFlush: 0,
              threeOfAKind: 0,
              straight: 0,
              flush: 0
            }
          }
        }
      } as TGuildConfiguration,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1'
    })

    expect(services.reserveCasinoBet).toHaveBeenCalledWith(
      expect.objectContaining({ totalBet: 100 })
    )
  })
})
