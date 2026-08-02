import type { Card, TBlackjackGame } from 'gambling-bot-shared/blackjack'
import {
  defaultCasinoSettings,
  emptySessionStats
} from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as services from '@/services'
import { finishBlackjackDealerAndSettle } from '@/utils/casino/blackjack'
import * as engineModule from '@/utils/casino/blackjack/engine'
import * as bigWin from '@/utils/discord/tryAnnounceBigWin'

const guildConfig = {
  globalSettings: defaultGlobalSettings,
  casinoSettings: defaultCasinoSettings
} as TGuildConfiguration

const card = (label: Card['label'], value: number): Card => ({
  label,
  value,
  suite: '♠️'
})

const baseGame: TBlackjackGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  gameId: 'game-1',
  activeBetId: 'bet-1',
  baseBetAmount: 100,
  basePairsBetAmount: null,
  activePairsBetAmount: null,
  basePlusThreeBetAmount: null,
  activePlusThreeBetAmount: null,
  insuranceBetAmount: null,
  pairsOutcome: null,
  plusThreeOutcome: null,
  showBalance: false,
  skipAnimations: false,
  sessionStats: emptySessionStats(),
  deck: [],
  deckIndex: 0,
  hands: [
    {
      cards: [card('10', 10), card('10', 10)],
      betAmount: 100,
      finished: true,
      isSplitHand: false
    }
  ],
  activeHandIndex: 0,
  phase: 'DEALER',
  dealerCards: [card('10', 10), card('7', 7)],
  createdAt: new Date(),
  updatedAt: new Date()
}

describe('finishBlackjackDealerAndSettle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(services, 'settleCasinoWinnings').mockResolvedValue(999)
    vi.spyOn(services, 'updateBlackjackGame').mockResolvedValue(null as never)
    vi.spyOn(bigWin, 'tryAnnounceBigWin').mockImplementation(() => undefined)
  })

  it('persists dealer draw progress, announces, edits the message, and shows balance', async () => {
    const getUserSpy = vi
      .spyOn(services, 'getUser')
      .mockResolvedValue({ balance: 1234 } as never)
    const persistProgress = vi.fn().mockResolvedValue(undefined)
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const result = await finishBlackjackDealerAndSettle({
      game: {
        ...baseGame,
        activeBetId: 'bet-even',
        deck: [card('4', 4)],
        hands: [
          {
            cards: [card('10', 10), card('10', 10)],
            betAmount: 100,
            finished: true,
            isSplitHand: false
          }
        ],
        dealerCards: [card('10', 10), card('6', 6)]
      },
      engine: {
        deck: [card('4', 4)],
        deckIndex: 0,
        hands: [
          {
            cards: [card('10', 10), card('10', 10)],
            betAmount: 100,
            finished: true,
            isSplitHand: false
          }
        ],
        activeHandIndex: 0,
        phase: 'DEALER',
        dealerCards: [card('10', 10), card('6', 6)]
      },
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } },
      sourceChannelId: 'channel-1',
      showBalance: true,
      message: message as never,
      finalMessageContent: 'Recovered after restart',
      persistProgress
    })

    expect(result.finalResultId).toBe('EVEN')
    expect(result.userBalance).toBe(1234)
    expect(persistProgress).toHaveBeenCalledTimes(1)
    expect(message.edit).toHaveBeenCalledTimes(1)
    expect(getUserSpy).toHaveBeenCalledTimes(1)
    expect(bigWin.tryAnnounceBigWin).toHaveBeenCalledTimes(1)
  })

  it('parks the session in RESULT and bumps stats', async () => {
    const result = await finishBlackjackDealerAndSettle({
      game: { ...baseGame, activeBetId: 'bet-stats' },
      engine: {
        deck: [],
        deckIndex: 0,
        hands: [
          {
            cards: [card('10', 10), card('10', 10)],
            betAmount: 100,
            finished: true,
            isSplitHand: false
          }
        ],
        activeHandIndex: 0,
        phase: 'DEALER',
        dealerCards: [card('10', 10), card('7', 7)]
      },
      guildConfig: null,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    expect(services.updateBlackjackGame).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        guildId: 'guild-1',
        phase: 'RESULT',
        activeBetId: null,
        activePairsBetAmount: null,
        activePlusThreeBetAmount: null,
        insuranceBetAmount: null,
        pairsOutcome: null,
        plusThreeOutcome: null
      })
    )
    expect(result.sessionStats).toMatchObject({
      roundsPlayed: 1,
      totalWagered: 100
    })
  })

  it('includes pairs stake in settle totals on the finish path', async () => {
    await finishBlackjackDealerAndSettle({
      game: {
        ...baseGame,
        activeBetId: 'bet-pairs',
        activePairsBetAmount: 25,
        pairsOutcome: 'mixed'
      },
      engine: {
        deck: [],
        deckIndex: 0,
        hands: [
          {
            cards: [card('10', 10), card('10', 10)],
            betAmount: 100,
            finished: true,
            isSplitHand: false
          }
        ],
        activeHandIndex: 0,
        phase: 'DEALER',
        dealerCards: [card('10', 10), card('10', 10)]
      },
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    // Push main 100 + mixed pairs 25*7=175 => total payout 275, total bet 125
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({
        totalBet: 125,
        winnings: 275
      })
    )
  })

  it('skips settling when the round has no active bet', async () => {
    const result = await finishBlackjackDealerAndSettle({
      game: { ...baseGame, activeBetId: null },
      engine: {
        deck: [],
        deckIndex: 0,
        hands: [
          {
            cards: [card('10', 10), card('8', 8)],
            betAmount: 100,
            finished: true,
            isSplitHand: false
          }
        ],
        activeHandIndex: 0,
        phase: 'DEALER',
        dealerCards: [card('10', 10), card('10', 10)]
      },
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
    expect(bigWin.tryAnnounceBigWin).not.toHaveBeenCalled()
    expect(result.sessionStats).toMatchObject({ roundsPlayed: 0 })
  })

  it('skips announcements when guild config is missing', async () => {
    const result = await finishBlackjackDealerAndSettle({
      game: {
        ...baseGame,
        activeBetId: 'bet-loss'
      },
      engine: {
        deck: [],
        deckIndex: 0,
        hands: [
          {
            cards: [card('10', 10), card('8', 8)],
            betAmount: 100,
            finished: true,
            isSplitHand: false
          }
        ],
        activeHandIndex: 0,
        phase: 'DEALER',
        dealerCards: [card('10', 10), card('10', 10)]
      },
      guildConfig: null,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    expect(result.finalResultId).toBe('LOSS')
    expect(result.userBalance).toBeUndefined()
    expect(bigWin.tryAnnounceBigWin).not.toHaveBeenCalled()
  })

  it('keeps userBalance undefined when lookup returns null', async () => {
    vi.spyOn(services, 'getUser').mockResolvedValue(null)

    const result = await finishBlackjackDealerAndSettle({
      game: {
        ...baseGame,
        activeBetId: 'bet-win'
      },
      engine: {
        deck: [],
        deckIndex: 0,
        hands: [
          {
            cards: [card('10', 10), card('10', 10)],
            betAmount: 100,
            finished: true,
            isSplitHand: false
          }
        ],
        activeHandIndex: 0,
        phase: 'DEALER',
        dealerCards: [card('10', 10), card('7', 7)]
      },
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: true
    })

    expect(result.finalResultId).toBe('WIN')
    expect(result.userBalance).toBeUndefined()
  })

  it('handles dealer draws without a progress callback', async () => {
    const result = await finishBlackjackDealerAndSettle({
      game: {
        ...baseGame,
        activeBetId: 'bet-draw-no-progress',
        deck: [card('4', 4)]
      },
      engine: {
        deck: [card('4', 4)],
        deckIndex: 0,
        hands: [
          {
            cards: [card('10', 10), card('10', 10)],
            betAmount: 100,
            finished: true,
            isSplitHand: false
          }
        ],
        activeHandIndex: 0,
        phase: 'DEALER',
        dealerCards: [card('10', 10), card('6', 6)]
      },
      guildConfig: null,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    expect(result.finalResultId).toBe('EVEN')
  })

  it('treats main push with lost side bets as an overall LOSS', async () => {
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const result = await finishBlackjackDealerAndSettle({
      game: {
        ...baseGame,
        activeBetId: 'bet-push-sides-lost',
        activePairsBetAmount: 100,
        activePlusThreeBetAmount: 100,
        pairsOutcome: null,
        plusThreeOutcome: null
      },
      engine: {
        deck: [],
        deckIndex: 0,
        hands: [
          {
            cards: [card('10', 10), card('K', 10)],
            betAmount: 1000,
            finished: true,
            isSplitHand: false
          }
        ],
        activeHandIndex: 0,
        phase: 'DEALER',
        dealerCards: [card('Q', 10), card('Q', 10)]
      },
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false,
      message: message as never
    })

    // Main push returns 1000; sides pay 0 → net -200.
    expect(result.totalBet).toBe(1200)
    expect(result.totalPayout).toBe(1000)
    expect(result.net).toBe(-200)
    expect(result.finalResultId).toBe('LOSS')

    const embed = message.edit.mock.calls[0]?.[0]?.embeds?.[0]
    expect(embed?.data?.description).toContain('You lose!')
    expect(embed?.data?.description).toContain('🔴')
  })

  it('ignores unresolved result states when summing payouts', async () => {
    vi.spyOn(engineModule, 'resolveResult').mockReturnValueOnce({
      finished: false
    })

    const result = await finishBlackjackDealerAndSettle({
      game: {
        ...baseGame,
        activeBetId: 'bet-unresolved'
      },
      engine: {
        deck: [],
        deckIndex: 0,
        hands: [
          {
            cards: [card('10', 10), card('10', 10)],
            betAmount: 100,
            finished: true,
            isSplitHand: false
          }
        ],
        activeHandIndex: 0,
        phase: 'DEALER',
        dealerCards: [card('10', 10), card('7', 7)]
      },
      guildConfig: null,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    expect(result.totalPayout).toBe(0)
    expect(result.finalResultId).toBe('LOSS')
  })
})
