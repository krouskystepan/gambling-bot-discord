import {
  defaultCasinoSettings,
  emptySessionStats
} from 'gambling-bot-shared/casino'
import type { TGuildConfiguration } from 'gambling-bot-shared/guild'
import { defaultGlobalSettings } from 'gambling-bot-shared/guild'
import type { TMinesGame } from 'gambling-bot-shared/mines'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as services from '@/services'
import { finishMinesAndSettle } from '@/utils/casino/mines/finish'
import * as bigWin from '@/utils/discord/tryAnnounceBigWin'

const guildConfig = {
  globalSettings: defaultGlobalSettings,
  casinoSettings: {
    ...defaultCasinoSettings,
    winAnnouncements: {
      ...defaultCasinoSettings.winAnnouncements,
      minesMinMultiplier: 1
    }
  }
} as TGuildConfiguration

const baseGame = ({
  revealedIndices,
  mineIndices = [0, 1, 2],
  activeBetId = 'bet-mines-1',
  status = 'RESULT'
}: {
  revealedIndices: number[]
  mineIndices?: number[]
  activeBetId?: string | null
  status?: TMinesGame['status']
}): TMinesGame => ({
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'msg-1',
  gameId: 'game-mines-1',
  activeBetId,
  betAmount: 100,
  mineCount: 3,
  mineIndices,
  revealedIndices,
  houseEdgeSnapshot: 0.03,
  status,
  showBalance: false,
  sessionStats: emptySessionStats(),
  createdAt: new Date(),
  updatedAt: new Date()
})

describe('finishMinesAndSettle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(services, 'settleCasinoWinnings').mockResolvedValue(999)
    vi.spyOn(services, 'updateMinesGame').mockResolvedValue(null as never)
    vi.spyOn(bigWin, 'tryAnnounceBigWin').mockImplementation(() => undefined)
  })

  it('settles a bust without announcing and parks the table in RESULT', async () => {
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const resolved = await finishMinesAndSettle({
      game: baseGame({ revealedIndices: [0] }),
      guildConfig,
      guild: { id: 'guild-1' } as never,
      sourceChannelId: 'channel-1',
      showBalance: false,
      message: message as never
    })

    expect(resolved.resultKind).toBe('BUST')
    expect(bigWin.tryAnnounceBigWin).not.toHaveBeenCalled()
    expect(message.edit).toHaveBeenCalled()
    expect(services.updateMinesGame).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        guildId: 'guild-1',
        status: 'RESULT',
        activeBetId: null
      })
    )
    expect(resolved.sessionStats).toMatchObject({
      roundsPlayed: 1,
      totalWagered: 100
    })
  })

  it('settles a cash-out, announces big win, and shows balance', async () => {
    const getUserSpy = vi
      .spyOn(services, 'getUser')
      .mockResolvedValue({ balance: 1500 } as never)
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const resolved = await finishMinesAndSettle({
      game: baseGame({ revealedIndices: [5, 6] }),
      guildConfig,
      guild: { id: 'guild-1', channels: { fetch: vi.fn() } } as never,
      sourceChannelId: 'channel-1',
      showBalance: true,
      message: message as never
    })

    expect(resolved.resultKind).toBe('CASH_OUT')
    expect(resolved.payout).toBeGreaterThan(100)
    expect(bigWin.tryAnnounceBigWin).toHaveBeenCalledWith(
      expect.objectContaining({
        game: 'mines',
        betId: 'game-mines-1',
        sourceChannelId: 'channel-1'
      })
    )
    expect(getUserSpy).toHaveBeenCalledWith({
      userId: 'user-1',
      guildId: 'guild-1'
    })
    expect(message.edit).toHaveBeenCalled()
  })

  it('settles a forfeit and renders without announcing', async () => {
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const resolved = await finishMinesAndSettle({
      game: baseGame({ revealedIndices: [] }),
      guildConfig: null,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false,
      message: message as never
    })

    expect(resolved.resultKind).toBe('FORFEIT')
    expect(bigWin.tryAnnounceBigWin).not.toHaveBeenCalled()
    expect(message.edit).toHaveBeenCalled()
    expect(services.settleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({
        winnings: 0,
        betId: 'bet-mines-1',
        game: 'mines'
      })
    )
    expect(services.updateMinesGame).toHaveBeenCalled()
  })

  it('skips settling when the round has no active bet', async () => {
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    const resolved = await finishMinesAndSettle({
      game: baseGame({ revealedIndices: [0], activeBetId: null }),
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false,
      message: message as never
    })

    expect(services.settleCasinoWinnings).not.toHaveBeenCalled()
    expect(resolved.sessionStats).toMatchObject({ roundsPlayed: 0 })
  })

  it('skips message edit when message is missing', async () => {
    const resolved = await finishMinesAndSettle({
      game: baseGame({ revealedIndices: [0] }),
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: false
    })

    expect(resolved.resultKind).toBe('BUST')
    expect(services.updateMinesGame).toHaveBeenCalled()
  })

  it('skips balance lookup when user is missing', async () => {
    vi.spyOn(services, 'getUser').mockResolvedValue(null)
    const message = { edit: vi.fn().mockResolvedValue(undefined) }

    await finishMinesAndSettle({
      game: baseGame({ revealedIndices: [5] }),
      guildConfig,
      guild: null,
      sourceChannelId: 'channel-1',
      showBalance: true,
      message: message as never
    })

    expect(message.edit).toHaveBeenCalled()
  })
})
