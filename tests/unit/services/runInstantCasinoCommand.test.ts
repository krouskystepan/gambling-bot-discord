import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmbedBuilder } from 'discord.js'

import { handleUnexpectedInteractionError } from '@/errors'
import {
  reserveCasinoBet,
  settleCasinoWinnings
} from '@/services/casino/casinoBet.service'
import { runInstantCasinoCommand } from '@/services/casino/runInstantCasinoCommand'
import { getUser } from '@/services/db/user.db'
import { checkCasinoChannels } from '@/services/guild/checkChannel.service'
import { checkUserRegistration } from '@/services/user/checkUserRegistration.service'
import { isUserOnCooldown } from '@/utils/common/userCooldown'
import { checkValidBet } from '@/utils/common/utils'
import { tryAnnounceBigWin } from '@/utils/discord/tryAnnounceBigWin'

vi.mock('@/services/user/checkUserRegistration.service', () => ({
  checkUserRegistration: vi.fn()
}))
vi.mock('@/services/guild/checkChannel.service', () => ({
  checkCasinoChannels: vi.fn()
}))
vi.mock('@/services/db/user.db', () => ({
  getUser: vi.fn()
}))
vi.mock('@/services/casino/casinoBet.service', () => ({
  reserveCasinoBet: vi.fn(),
  settleCasinoWinnings: vi.fn()
}))
vi.mock('@/utils/common/userCooldown', () => ({
  isUserOnCooldown: vi.fn()
}))
vi.mock('@/utils/common/utils', () => ({
  checkValidBet: vi.fn()
}))
vi.mock('@/utils/discord/tryAnnounceBigWin', () => ({
  tryAnnounceBigWin: vi.fn()
}))
vi.mock('@/errors', () => ({
  handleUnexpectedInteractionError: vi.fn()
}))
vi.mock('gambling-bot-shared/common', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('gambling-bot-shared/common')>()
  return {
    ...actual,
    generateId: vi.fn(() => 'BET123'),
    formatMoney: vi.fn((n: number) => `$${n}`)
  }
})
vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string, description: string) => ({
    title,
    description
  })
}))

const mockCheckUserRegistration = vi.mocked(checkUserRegistration)
const mockCheckCasinoChannels = vi.mocked(checkCasinoChannels)
const mockIsUserOnCooldown = vi.mocked(isUserOnCooldown)
const mockCheckValidBet = vi.mocked(checkValidBet)
const mockReserveCasinoBet = vi.mocked(reserveCasinoBet)
const mockSettleCasinoWinnings = vi.mocked(settleCasinoWinnings)
const mockGetUser = vi.mocked(getUser)
const mockTryAnnounceBigWin = vi.mocked(tryAnnounceBigWin)
const mockHandleUnexpected = vi.mocked(handleUnexpectedInteractionError)

const guildConfig = {
  globalSettings: { currencySymbol: '$' },
  casinoSettings: {}
}

const prepared = {
  ok: true as const,
  totalBet: 100,
  validateBetAmount: 100,
  minBet: 1,
  maxBet: 1000,
  input: {}
}

const createInteraction = () => ({
  user: { id: 'user-1' },
  guildId: 'guild-1',
  guild: { id: 'guild-1' },
  channelId: 'ch-1',
  options: {
    getBoolean: vi.fn((name: string) =>
      name === 'show-balance' ? true : name === 'skip-animations' ? false : null
    )
  },
  reply: vi.fn().mockResolvedValue(undefined),
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue(undefined)
})

describe('runInstantCasinoCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckUserRegistration.mockResolvedValue({
      userId: 'user-1',
      guildId: 'guild-1'
    } as never)
    mockIsUserOnCooldown.mockReturnValue(false)
    mockCheckCasinoChannels.mockResolvedValue(guildConfig as never)
    mockCheckValidBet.mockReturnValue(true)
    mockReserveCasinoBet.mockResolvedValue(undefined as never)
    mockSettleCasinoWinnings.mockResolvedValue(900 as never)
  })

  it('stops before reserving when registration, cooldown, channels, prepare, or bet checks fail', async () => {
    const interaction = createInteraction()

    mockCheckUserRegistration.mockResolvedValueOnce(null as never)
    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: vi.fn(),
      executeGame: vi.fn()
    })
    expect(mockReserveCasinoBet).not.toHaveBeenCalled()

    mockIsUserOnCooldown.mockReturnValueOnce(true)
    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: vi.fn(),
      executeGame: vi.fn()
    })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: 'Slow Down' })]
      })
    )

    mockCheckCasinoChannels.mockResolvedValueOnce(false)
    const prepareInput = vi.fn()
    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput,
      executeGame: vi.fn()
    })
    expect(prepareInput).not.toHaveBeenCalled()

    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: async () => ({ ok: false }),
      executeGame: vi.fn()
    })
    expect(mockReserveCasinoBet).not.toHaveBeenCalled()

    mockCheckValidBet.mockReturnValueOnce(false)
    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: async () => prepared,
      executeGame: vi.fn()
    })
    expect(mockReserveCasinoBet).not.toHaveBeenCalled()
  })

  it('replies with insufficient funds and does not defer when reserve fails', async () => {
    mockReserveCasinoBet.mockRejectedValue(new Error('INSUFFICIENT_FUNDS'))
    mockGetUser.mockResolvedValue(null)
    const interaction = createInteraction()

    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: async () => prepared,
      executeGame: vi.fn()
    })

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            title: 'Insufficient Funds',
            description: expect.stringContaining('$0')
          })
        ]
      })
    )
    expect(interaction.deferReply).not.toHaveBeenCalled()
  })

  it('routes unexpected reserve errors through the interaction error handler', async () => {
    mockReserveCasinoBet.mockRejectedValue(new Error('DB_DOWN'))
    const interaction = createInteraction()

    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: async () => prepared,
      executeGame: vi.fn()
    })

    expect(mockHandleUnexpected).toHaveBeenCalled()
  })

  it('reserves, settles, announces, and edits the final reply', async () => {
    const interaction = createInteraction()
    const finalEmbed = new EmbedBuilder().setTitle('Win')

    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: async () => ({
        ...prepared,
        totalBet: 200,
        input: { side: 3 }
      }),
      executeGame: async () => ({
        totalWinnings: 300,
        buildFinalEmbed: (balance) => {
          expect(balance).toBe(900)
          return finalEmbed
        },
        announce: {
          game: 'dice',
          lines: ['line-1'],
          sourceChannelId: 'ch-1'
        }
      })
    })

    expect(mockReserveCasinoBet).toHaveBeenCalledWith({
      userId: 'user-1',
      guildId: 'guild-1',
      totalBet: 200,
      betId: 'BET123',
      game: 'dice'
    })
    expect(mockSettleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({ winnings: 300, betId: 'BET123' })
    )
    expect(mockTryAnnounceBigWin).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'dice', lines: ['line-1'] })
    )
    expect(interaction.editReply).toHaveBeenCalledWith({
      embeds: [finalEmbed]
    })
  })

  it('skips announcements when executeGame omits announce', async () => {
    const interaction = createInteraction()

    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: async () => prepared,
      executeGame: async () => ({
        totalWinnings: 0,
        buildFinalEmbed: () => new EmbedBuilder().setTitle('Loss')
      })
    })

    expect(mockTryAnnounceBigWin).not.toHaveBeenCalled()
  })

  it('refunds via settle when executeGame throws, and still reports the original error', async () => {
    const interaction = createInteraction()

    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: async () => prepared,
      executeGame: async () => {
        throw new Error('boom')
      }
    })

    expect(mockSettleCasinoWinnings).toHaveBeenCalledWith(
      expect.objectContaining({ winnings: 0, betId: 'BET123' })
    )
    expect(mockHandleUnexpected).toHaveBeenCalled()
  })

  it('does not hide the original error if the refund settle also fails', async () => {
    const interaction = createInteraction()
    mockSettleCasinoWinnings.mockRejectedValue(new Error('settle failed'))

    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: async () => prepared,
      executeGame: async () => {
        throw new Error('boom')
      }
    })

    expect(mockHandleUnexpected).toHaveBeenCalled()
  })

  it('does not settle when the failure happens before a bet exists', async () => {
    const interaction = createInteraction()

    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: async () => {
        throw new Error('prepare failed')
      },
      executeGame: vi.fn()
    })

    expect(mockSettleCasinoWinnings).not.toHaveBeenCalled()
    expect(mockHandleUnexpected).toHaveBeenCalled()
  })

  it('does not refund again after the bet was already settled', async () => {
    const interaction = createInteraction()
    interaction.editReply.mockRejectedValue(new Error('edit failed'))

    await runInstantCasinoCommand({
      interaction: interaction as never,
      game: 'dice',
      prepareInput: async () => prepared,
      executeGame: async () => ({
        totalWinnings: 50,
        buildFinalEmbed: () => new EmbedBuilder().setTitle('Done')
      })
    })

    expect(mockSettleCasinoWinnings).toHaveBeenCalledTimes(1)
    expect(mockHandleUnexpected).toHaveBeenCalled()
  })
})
