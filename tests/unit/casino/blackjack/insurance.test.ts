import type { Card, TBlackjackGame } from 'gambling-bot-shared/blackjack'
import {
  defaultCasinoSettings,
  emptySessionStats
} from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as services from '@/services'
import { resolveBlackjackInsuranceDecision } from '@/utils/casino/blackjack/insurance'

const guildConfig = {
  globalSettings: defaultGlobalSettings,
  casinoSettings: defaultCasinoSettings
} as TGuildConfiguration

const card = (
  label: Card['label'],
  suite: Card['suite'],
  value: number
): Card => ({ label, suite, value })

const insuranceGame = (dealerHole: Card): TBlackjackGame => ({
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  gameId: 'game-1',
  activeBetId: 'bet-1',
  baseBetAmount: 100,
  basePairsBetAmount: 10,
  activePairsBetAmount: 10,
  basePlusThreeBetAmount: null,
  activePlusThreeBetAmount: null,
  insuranceBetAmount: null,
  pairsOutcome: 'mixed',
  plusThreeOutcome: null,
  showBalance: false,
  skipAnimations: false,
  sessionStats: emptySessionStats(),
  deck: Array.from({ length: 48 }, () => card('2', '♠️', 2)),
  deckIndex: 4,
  hands: [
    {
      cards: [card('9', '♠️', 9), card('9', '♥️', 9)],
      betAmount: 100,
      finished: false,
      isSplitHand: false
    }
  ],
  activeHandIndex: 0,
  phase: 'INSURANCE',
  dealerCards: [card('A', '♦️', 11), dealerHole],
  createdAt: new Date(),
  updatedAt: new Date()
})

describe('resolveBlackjackInsuranceDecision', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(services, 'reserveCasinoBet').mockResolvedValue(undefined as never)
    vi.spyOn(services, 'settleCasinoWinnings').mockResolvedValue(500)
    vi.spyOn(services, 'upsertBlackjackGame').mockResolvedValue(null as never)
    vi.spyOn(services, 'updateBlackjackGame').mockResolvedValue(null as never)
  })

  it('reserves insurance and settles when dealer has blackjack', async () => {
    const result = await resolveBlackjackInsuranceDecision({
      game: insuranceGame(card('K', '♣️', 10)),
      takeInsurance: true,
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    expect(services.reserveCasinoBet).toHaveBeenCalledWith(
      expect.objectContaining({
        totalBet: 50,
        betId: 'bet-1:ins'
      })
    )
    // Main loss 0 + pairs mixed 70 + insurance 150 = 220; totalBet 100+10+50=160
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({
        totalBet: 160,
        winnings: 220
      })
    )
    expect(result.phase).toBe('RESULT')
  })

  it('declines insurance: pairs can still pay, main loses, insurance 0', async () => {
    const result = await resolveBlackjackInsuranceDecision({
      game: insuranceGame(card('K', '♣️', 10)),
      takeInsurance: false,
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    expect(services.reserveCasinoBet).not.toHaveBeenCalled()
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({
        totalBet: 110,
        winnings: 70
      })
    )
    expect(result.phase).toBe('RESULT')
  })

  it('continues to PLAYER when neither has blackjack', async () => {
    const result = await resolveBlackjackInsuranceDecision({
      game: insuranceGame(card('9', '♣️', 9)),
      takeInsurance: false,
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
    expect(result.phase).toBe('PLAYER')
    expect(services.upsertBlackjackGame).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'PLAYER',
        insuranceBetAmount: null,
        activePairsBetAmount: 10
      })
    )
  })

  it('classifies pairs when pairsOutcome was not persisted', async () => {
    const game = {
      ...insuranceGame(card('9', '♣️', 9)),
      pairsOutcome: null,
      activePairsBetAmount: null
    }

    const result = await resolveBlackjackInsuranceDecision({
      game,
      takeInsurance: false,
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    expect(result.phase).toBe('PLAYER')
    expect(services.upsertBlackjackGame).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'PLAYER',
        activePairsBetAmount: null,
        pairsOutcome: null
      })
    )
  })

  it('rejects missing active bet or invalid card state', async () => {
    await expect(
      resolveBlackjackInsuranceDecision({
        game: { ...insuranceGame(card('9', '♣️', 9)), activeBetId: null },
        takeInsurance: false,
        guildConfig,
        guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
        sourceChannelId: 'channel-1',
        showBalance: false
      })
    ).rejects.toThrow('MISSING_ACTIVE_BET')

    await expect(
      resolveBlackjackInsuranceDecision({
        game: {
          ...insuranceGame(card('9', '♣️', 9)),
          hands: [],
          dealerCards: [card('A', '♦️', 11)]
        },
        takeInsurance: false,
        guildConfig,
        guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
        sourceChannelId: 'channel-1',
        showBalance: false
      })
    ).rejects.toThrow('INVALID_INSURANCE_STATE')
  })
})
