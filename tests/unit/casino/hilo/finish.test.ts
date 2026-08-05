import {
  type THiloGame,
  defaultCasinoSettings,
  emptySessionStats
} from 'gambling-bot-shared/casino'
import * as casinoShared from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as services from '@/services'
import {
  cashOutHilo,
  settleHiloGuess,
  settleHiloTimeout
} from '@/utils/casino/hilo/finish'
import * as bigWin from '@/utils/discord/tryAnnounceBigWin'

vi.mock('gambling-bot-shared/casino', async (importOriginal) => {
  const actual = await importOriginal<typeof import('gambling-bot-shared/casino')>()
  return {
    ...actual,
    applyHiloGuess: vi.fn(actual.applyHiloGuess),
    cashOutHiloPayout: vi.fn(actual.cashOutHiloPayout)
  }
})

const guildConfig = {
  globalSettings: defaultGlobalSettings,
  casinoSettings: {
    ...defaultCasinoSettings,
    winAnnouncements: {
      ...defaultCasinoSettings.winAnnouncements,
      hiloMinMultiplier: 1
    }
  }
} as TGuildConfiguration

const baseGame = (overrides?: Partial<THiloGame>): THiloGame => ({
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  gameId: 'hilo-1',
  activeBetId: 'hilo-1',
  betAmount: 100,
  firstCard: { label: '7', suite: '♥️', rank: 7 },
  remainingDeck: [{ label: 'A', suite: '♠️', rank: 14 }],
  currentMultiplier: 1,
  streak: 0,
  houseEdgeSnapshot: 0.01,
  showBalance: false,
  skipAnimations: false,
  status: 'WAITING',
  sessionStats: emptySessionStats(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

describe('hilo finish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(services, 'claimHiloGameForSettle').mockImplementation(
      async ({ gameId }) =>
        gameId === 'hilo-1' ? (baseGame({ status: 'SETTLING' }) as never) : null
    )
    vi.spyOn(services, 'settleCasinoWinnings').mockResolvedValue(900)
    vi.spyOn(services, 'updateHiloGame').mockResolvedValue(undefined as never)
    vi.spyOn(services, 'getUser').mockResolvedValue({
      balance: 900,
      lockedBalance: 0
    } as never)
    vi.spyOn(bigWin, 'tryAnnounceBigWin').mockImplementation(() => undefined)
  })

  it('settles a winning guess when the deck empties and parks in RESULT', async () => {
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    // Low house edge so compounded step mult clears announce threshold.
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        houseEdgeSnapshot: 0
      }) as never
    )

    const result = await settleHiloGuess({
      game: baseGame({ houseEdgeSnapshot: 0 }),
      guess: 'higher',
      guildConfig,
      guild: { id: 'guild-1' } as never,
      sourceChannelId: 'channel-1',
      message: message as never
    })

    expect(result?.outcome).toBe('win')
    expect(result?.continued).toBe(false)
    expect(services.settleCasinoWinnings).toHaveBeenCalled()
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'RESULT',
        activeBetId: null,
        currentMultiplier: 1,
        streak: 0
      })
    )
    expect(bigWin.tryAnnounceBigWin).toHaveBeenCalledWith(
      expect.objectContaining({
        game: 'hilo',
        betId: 'hilo-1'
      })
    )
    expect(message.edit).toHaveBeenCalled()
  })

  it('continues after a correct guess when cards remain', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        remainingDeck: [
          { label: '10', suite: '♣️', rank: 10 },
          { label: 'A', suite: '♠️', rank: 14 }
        ]
      }) as never
    )

    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const result = await settleHiloGuess({
      game: baseGame({
        remainingDeck: [
          { label: '10', suite: '♣️', rank: 10 },
          { label: 'A', suite: '♠️', rank: 14 }
        ]
      }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      message: message as never
    })

    expect(result?.outcome).toBe('win')
    expect(result?.continued).toBe(true)
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'WAITING',
        streak: 1,
        firstCard: expect.objectContaining({ rank: 14 })
      })
    )
    expect(message.edit).toHaveBeenCalled()
  })

  it('continues without editing when message is missing', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        remainingDeck: [
          { label: '10', suite: '♣️', rank: 10 },
          { label: 'A', suite: '♠️', rank: 14 }
        ]
      }) as never
    )

    const result = await settleHiloGuess({
      game: baseGame({
        remainingDeck: [
          { label: '10', suite: '♣️', rank: 10 },
          { label: 'A', suite: '♠️', rank: 14 }
        ]
      }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result?.continued).toBe(true)
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
  })

  it('auto-cashes after a win without editing when message is missing', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        houseEdgeSnapshot: 0,
        remainingDeck: [
          { label: '10', suite: '♣️', rank: 10 },
          { label: 'A', suite: '♠️', rank: 14 }
        ]
      }) as never
    )

    const result = await settleHiloGuess({
      game: baseGame({
        houseEdgeSnapshot: 0,
        remainingDeck: [
          { label: '10', suite: '♣️', rank: 10 },
          { label: 'A', suite: '♠️', rank: 14 }
        ]
      }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      cashOutAfterWin: true
    })

    expect(result).toEqual(
      expect.objectContaining({
        outcome: 'win',
        continued: false
      })
    )
    expect(services.settleCasinoWinnings).toHaveBeenCalled()
  })

  it('settles a losing guess without announcing', async () => {
    // Trailing reveal is 2 (lose); Ace keeps "higher" possible.
    const deck = [
      { label: 'A', suite: '♠️' as const, rank: 14 },
      { label: '2', suite: '♣️' as const, rank: 2 }
    ]
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        remainingDeck: deck
      }) as never
    )

    const message = { edit: vi.fn().mockResolvedValue(undefined) }
    const result = await settleHiloGuess({
      game: baseGame({
        remainingDeck: deck
      }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      message: message as never
    })

    expect(result?.outcome).toBe('lose')
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({ winnings: 0 })
    )
    expect(bigWin.tryAnnounceBigWin).not.toHaveBeenCalled()
    expect(message.edit).toHaveBeenCalled()
  })

  it('loses higher/lower when ranks match', async () => {
    // Trailing reveal ties at 7; Ace keeps "higher" possible.
    const deck = [
      { label: 'A', suite: '♠️' as const, rank: 14 },
      { label: '7', suite: '♦️' as const, rank: 7 }
    ]
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        remainingDeck: deck
      }) as never
    )

    const result = await settleHiloGuess({
      game: baseGame({
        remainingDeck: deck
      }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result?.outcome).toBe('lose')
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({ winnings: 0 })
    )
  })

  it('keeps settle balance when showBalance user lookup misses', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({ showBalance: true, status: 'SETTLING' }) as never
    )
    vi.mocked(services.getUser).mockResolvedValueOnce(null)

    const result = await settleHiloGuess({
      game: baseGame({ showBalance: true }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result?.outcome).toBe('win')
    expect(services.getUser).toHaveBeenCalled()
  })

  it('returns stake when the chosen side cannot win', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        firstCard: { label: 'A', suite: '♠️', rank: 14 },
        remainingDeck: [{ label: 'K', suite: '♥️', rank: 13 }],
        status: 'SETTLING'
      }) as never
    )

    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const result = await settleHiloGuess({
      game: baseGame({ firstCard: { label: 'A', suite: '♠️', rank: 14 } }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      message: message as never
    })

    expect(result).toBeNull()
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({
        winnings: 100,
        betId: 'hilo-1'
      })
    )
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'RESULT' })
    )
    expect(message.edit).toHaveBeenCalled()
  })

  it('returns stake without editing when impossible side has no message', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        firstCard: { label: 'A', suite: '♠️', rank: 14 },
        remainingDeck: [{ label: 'K', suite: '♥️', rank: 13 }],
        status: 'SETTLING'
      }) as never
    )

    const result = await settleHiloGuess({
      game: baseGame({ firstCard: { label: 'A', suite: '♠️', rank: 14 } }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result).toBeNull()
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'RESULT' })
    )
  })

  it('parks a corrupt claimed round without settling', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        betAmount: null,
        firstCard: null,
        activeBetId: null,
        status: 'SETTLING'
      }) as never
    )

    const result = await settleHiloGuess({
      game: baseGame(),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result).toBeNull()
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'RESULT', activeBetId: null })
    )
  })

  it('no-ops timeout when the first card is missing', async () => {
    const result = await settleHiloTimeout({
      game: baseGame({ firstCard: null }),
      guildConfig
    })

    expect(result).toBeNull()
    expect(services.claimHiloGameForSettle).not.toHaveBeenCalled()
  })

  it('loads balance when showBalance is enabled', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({ showBalance: true, status: 'SETTLING' }) as never
    )

    await settleHiloGuess({
      game: baseGame({ showBalance: true }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      message: { edit: vi.fn().mockResolvedValue(undefined) } as never
    })

    expect(services.getUser).toHaveBeenCalledWith({
      userId: 'user-1',
      guildId: 'guild-1'
    })
  })

  it('no-ops when claim loses the race', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(null)

    const result = await settleHiloGuess({
      game: baseGame(),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result).toBeNull()
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
  })

  it('formats second card when deck entries only expose fields via prototype', async () => {
    const stored = Object.create({
      label: 'K',
      suite: '♦️',
      rank: 13
    }) as THiloGame['firstCard']

    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        remainingDeck: [stored!]
      }) as never
    )

    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const result = await settleHiloGuess({
      game: baseGame({ remainingDeck: [stored!] }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      message: message as never
    })

    expect(result?.outcome).toBe('win')
    expect(message.edit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining('7♥️ → K♦️')
            })
          })
        ]
      })
    )
  })

  it('settles a same-rank draw win', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        houseEdgeSnapshot: 0,
        remainingDeck: [{ label: '7', suite: '♣️', rank: 7 }]
      }) as never
    )

    const result = await settleHiloGuess({
      game: baseGame({
        houseEdgeSnapshot: 0,
        remainingDeck: [{ label: '7', suite: '♣️', rank: 7 }]
      }),
      guess: 'same',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result?.outcome).toBe('win')
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({
        winnings: expect.any(Number)
      })
    )
    const winnings = vi.mocked(services.settleCasinoWinnings).mock.calls[0]?.[0]
      .winnings as number
    // Only one matching card left → fair odds are even money before house edge.
    expect(winnings).toBe(100)
  })

  it('settles a same-rank draw loss', async () => {
    // Trailing reveal is Ace (lose); matching 7 keeps "same" possible.
    const deck = [
      { label: '7', suite: '♣️' as const, rank: 7 },
      { label: 'A', suite: '♠️' as const, rank: 14 }
    ]
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        remainingDeck: deck
      }) as never
    )

    const result = await settleHiloGuess({
      game: baseGame({ remainingDeck: deck }),
      guess: 'same',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result?.outcome).toBe('lose')
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({ winnings: 0 })
    )
  })

  it('cashes out a streak on cashOutHilo', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        streak: 2,
        currentMultiplier: 3.5,
        remainingDeck: [
          { label: '10', suite: '♣️', rank: 10 },
          { label: '2', suite: '♦️', rank: 2 }
        ]
      }) as never
    )

    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const result = await cashOutHilo({
      game: baseGame({ streak: 2, currentMultiplier: 3.5 }),
      guildConfig,
      guild: { id: 'guild-1' } as never,
      sourceChannelId: 'channel-1',
      message: message as never
    })

    expect(result?.multiplier).toBe(3.5)
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({ winnings: 350 })
    )
    expect(bigWin.tryAnnounceBigWin).toHaveBeenCalled()
    expect(message.edit).toHaveBeenCalled()
  })

  it('ignores cash-out when streak is 0', async () => {
    const result = await cashOutHilo({
      game: baseGame({ streak: 0 }),
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result).toBeNull()
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'WAITING' })
    )
  })

  it('auto-cashes out on timeout when streak >= 1', async () => {
    const waiting = baseGame({
      streak: 1,
      currentMultiplier: 2,
      remainingDeck: [
        { label: '10', suite: '♣️', rank: 10 },
        { label: '3', suite: '♦️', rank: 3 }
      ]
    })
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce({
      ...waiting,
      status: 'SETTLING'
    } as never)

    const result = await settleHiloTimeout({
      game: waiting,
      guildConfig
    })

    expect(result).toEqual(
      expect.objectContaining({
        totalWinnings: 200,
        multiplier: 2
      })
    )
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({ winnings: 200 })
    )
  })

  it('auto-plays the safest side on timeout when streak is 0', async () => {
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const result = await settleHiloTimeout({
      game: baseGame(),
      guildConfig,
      message: message as never
    })

    // First card 7 → safest is higher; Ace second + empty deck → settle win.
    expect(result).toEqual(
      expect.objectContaining({
        outcome: 'win',
        continued: false
      })
    )
    expect(services.settleCasinoWinnings).toHaveBeenCalled()
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'RESULT' })
    )
    expect(message.edit).toHaveBeenCalled()
  })

  it('cashes out after a timeout auto-win when cards remain', async () => {
    const deck = [
      { label: '10', suite: '♣️' as const, rank: 10 },
      { label: 'A', suite: '♠️' as const, rank: 14 }
    ]
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        houseEdgeSnapshot: 0,
        remainingDeck: deck
      }) as never
    )

    const message = { edit: vi.fn().mockResolvedValue(undefined) }
    const result = await settleHiloTimeout({
      game: baseGame({
        houseEdgeSnapshot: 0,
        remainingDeck: deck
      }),
      guildConfig,
      guild: { id: 'guild-1' } as never,
      message: message as never
    })

    expect(result).toEqual(
      expect.objectContaining({
        outcome: 'win',
        continued: false
      })
    )
    expect(services.settleCasinoWinnings).toHaveBeenCalled()
    expect(bigWin.tryAnnounceBigWin).toHaveBeenCalled()
    expect(message.edit).toHaveBeenCalled()
  })

  it('parks when applyHiloGuess is ignored after a valid multiplier', async () => {
    vi.mocked(casinoShared.applyHiloGuess).mockReturnValueOnce({
      kind: 'IGNORED',
      reason: 'EMPTY_DECK'
    })

    const result = await settleHiloGuess({
      game: baseGame(),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result).toBeNull()
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'RESULT', activeBetId: null })
    )
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
  })

  it('parks when applyHiloGuess is impossible after a valid multiplier', async () => {
    vi.mocked(casinoShared.applyHiloGuess).mockReturnValueOnce({
      kind: 'IMPOSSIBLE',
      reason: 'NO_FAVORABLE'
    })

    const result = await settleHiloGuess({
      game: baseGame(),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result).toBeNull()
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'RESULT', activeBetId: null })
    )
  })

  it('parks when cash-out after a winning continue fails', async () => {
    vi.mocked(casinoShared.applyHiloGuess).mockReturnValueOnce({
      kind: 'CONTINUE',
      guess: 'higher',
      revealed: { label: 'A', suite: '♠️', rank: 14 },
      stepMultiplier: 1.5,
      currentMultiplier: 1.5,
      streak: 1
    })
    vi.mocked(casinoShared.cashOutHiloPayout).mockReturnValueOnce({
      kind: 'IGNORED',
      reason: 'NO_STREAK'
    })

    const result = await settleHiloGuess({
      game: baseGame({
        remainingDeck: [
          { label: '10', suite: '♣️', rank: 10 },
          { label: 'A', suite: '♠️', rank: 14 }
        ]
      }),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      cashOutAfterWin: true
    })

    expect(result).toBeNull()
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'RESULT', activeBetId: null })
    )
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
  })

  it('no-ops cash-out when claim loses the race', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(null)

    const result = await cashOutHilo({
      game: baseGame({ streak: 2, currentMultiplier: 2 }),
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result).toBeNull()
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
  })

  it('parks incomplete cash-out claims into RESULT', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        betAmount: null,
        firstCard: null,
        activeBetId: null
      }) as never
    )

    const result = await cashOutHilo({
      game: baseGame({ streak: 2, currentMultiplier: 2 }),
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result).toBeNull()
    expect(services.updateHiloGame).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'RESULT', activeBetId: null })
    )
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
  })

  it('settles timeout without editing when message is missing', async () => {
    const result = await settleHiloTimeout({
      game: baseGame(),
      guildConfig
    })

    expect(result).toEqual(
      expect.objectContaining({
        outcome: 'win',
        continued: false
      })
    )
    expect(services.updateHiloGame).toHaveBeenCalled()
  })

  it('no-ops timeout when guild config is missing', async () => {
    const result = await settleHiloTimeout({
      game: baseGame(),
      guildConfig: null
    })

    expect(result).toBeNull()
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
  })

  it('no-ops timeout when claim loses the race', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(null)

    const result = await settleHiloTimeout({
      game: baseGame(),
      guildConfig
    })

    expect(result).toBeNull()
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
  })
})
