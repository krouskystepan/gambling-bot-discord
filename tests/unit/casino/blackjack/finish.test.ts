import { defaultCasinoSettings } from 'gambling-bot-shared/casino'
import type { Card, TBlackjackGame } from 'gambling-bot-shared/blackjack'
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
  betId: 'bet-1',
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
    vi.spyOn(services, 'deleteBlackjackGame').mockResolvedValue(undefined)
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
        betId: 'bet-even',
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

  it('skips announcements when guild config is missing', async () => {
    const result = await finishBlackjackDealerAndSettle({
      game: {
        ...baseGame,
        betId: 'bet-loss'
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
        betId: 'bet-win'
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
        betId: 'bet-draw-no-progress',
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

  it('ignores unresolved result states when summing payouts', async () => {
    vi.spyOn(engineModule, 'resolveResult').mockReturnValueOnce({
      finished: false
    })

    const result = await finishBlackjackDealerAndSettle({
      game: {
        ...baseGame,
        betId: 'bet-unresolved'
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
