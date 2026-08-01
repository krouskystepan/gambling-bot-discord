import {
  type THiloGame,
  defaultCasinoSettings
} from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as services from '@/services'
import { settleHiloGuess, settleHiloTimeout } from '@/utils/casino/hilo/finish'
import * as rng from '@/utils/casino/rng'
import * as bigWin from '@/utils/discord/tryAnnounceBigWin'

vi.mock('@/utils/casino/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/casino/rng')>()
  return {
    ...actual,
    drawHiloCard: vi.fn(() => ({ label: 'A', suite: '♠️', rank: 14 }))
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
  houseEdgeSnapshot: 0.01,
  timeoutFeeSnapshot: 0.1,
  showBalance: false,
  status: 'WAITING',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

describe('hilo finish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rng.drawHiloCard).mockReturnValue({
      label: 'A',
      suite: '♠️',
      rank: 14
    })
    vi.spyOn(services, 'claimHiloGameForSettle').mockImplementation(
      async ({ gameId }) =>
        gameId === 'hilo-1' ? (baseGame({ status: 'SETTLING' }) as never) : null
    )
    vi.spyOn(services, 'settleCasinoWinnings').mockResolvedValue(900)
    vi.spyOn(services, 'deleteHiloGame').mockResolvedValue(undefined as never)
    vi.spyOn(services, 'getUser').mockResolvedValue({
      balance: 900,
      lockedBalance: 0
    } as never)
    vi.spyOn(bigWin, 'tryAnnounceBigWin').mockImplementation(() => undefined)
  })

  it('settles a winning guess and announces', async () => {
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const result = await settleHiloGuess({
      game: baseGame(),
      guess: 'higher',
      guildConfig,
      guild: { id: 'guild-1' } as never,
      sourceChannelId: 'channel-1',
      message: message as never
    })

    expect(result?.outcome).toBe('win')
    expect(services.settleCasinoWinnings).toHaveBeenCalled()
    expect(services.deleteHiloGame).toHaveBeenCalled()
    expect(bigWin.tryAnnounceBigWin).toHaveBeenCalledWith(
      expect.objectContaining({
        game: 'hilo',
        betId: 'hilo-1'
      })
    )
    expect(message.edit).toHaveBeenCalled()
  })

  it('settles a losing guess without announcing', async () => {
    vi.mocked(rng.drawHiloCard).mockReturnValueOnce({
      label: '2',
      suite: '♣️',
      rank: 2
    })

    const result = await settleHiloGuess({
      game: baseGame(),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result?.outcome).toBe('lose')
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({ winnings: 0 })
    )
    expect(bigWin.tryAnnounceBigWin).not.toHaveBeenCalled()
  })

  it('settles a push when ranks match', async () => {
    vi.mocked(rng.drawHiloCard).mockReturnValueOnce({
      label: '7',
      suite: '♦️',
      rank: 7
    })

    const result = await settleHiloGuess({
      game: baseGame(),
      guess: 'higher',
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1'
    })

    expect(result?.outcome).toBe('push')
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({ winnings: 100 })
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
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({
        winnings: 100,
        betId: 'hilo-1'
      })
    )
    expect(services.deleteHiloGame).toHaveBeenCalled()
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

    vi.mocked(rng.drawHiloCard).mockImplementationOnce((deck) => {
      const card = deck.pop()
      if (!card) throw new Error('Hi-Lo deck is empty')
      return card
    })
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(
      baseGame({
        status: 'SETTLING',
        remainingDeck: [stored]
      }) as never
    )

    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const result = await settleHiloGuess({
      game: baseGame({ remainingDeck: [stored] }),
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
    vi.mocked(rng.drawHiloCard).mockReturnValueOnce({
      label: '7',
      suite: '♣️',
      rank: 7
    })

    const result = await settleHiloGuess({
      game: baseGame(),
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
    expect(winnings).toBeGreaterThan(100)
  })

  it('settles a same-rank draw loss', async () => {
    vi.mocked(rng.drawHiloCard).mockReturnValueOnce({
      label: 'A',
      suite: '♠️',
      rank: 14
    })

    const result = await settleHiloGuess({
      game: baseGame(),
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

  it('applies timeout fee settlement', async () => {
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const result = await settleHiloTimeout({
      game: baseGame(),
      guildConfig,
      message: message as never
    })

    expect(result).toEqual({ refunded: 90, feeKept: 10 })
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({
        totalBet: 100,
        winnings: 90,
        betId: 'hilo-1',
        game: 'hilo'
      })
    )
    expect(message.edit).toHaveBeenCalled()
  })

  it('settles timeout without editing when message is missing', async () => {
    const result = await settleHiloTimeout({
      game: baseGame(),
      guildConfig: null
    })

    expect(result).toEqual({ refunded: 90, feeKept: 10 })
    expect(services.deleteHiloGame).toHaveBeenCalled()
  })

  it('no-ops timeout when claim loses the race', async () => {
    vi.mocked(services.claimHiloGameForSettle).mockResolvedValueOnce(null)

    const result = await settleHiloTimeout({
      game: baseGame(),
      guildConfig: null
    })

    expect(result).toBeNull()
    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
  })
})
