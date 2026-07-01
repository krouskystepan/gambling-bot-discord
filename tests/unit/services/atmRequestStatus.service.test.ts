import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getLatestUserAtmRequest,
  getUserAtmRequest,
  searchUserAtmRequestsForAutocomplete
} from '@/services/db/atmRequest.db'
import {
  handleAtmStatusSubcommand,
  respondAtmRequestStatusAutocomplete
} from '@/services/atm/atmRequestStatus.service'
import {
  checkUserRegistration,
  getGuildConfigByGuildId
} from '@/services'
import { logger } from '@/utils/logger'

vi.mock('@/services', () => ({
  checkUserRegistration: vi.fn(),
  getGuildConfigByGuildId: vi.fn()
}))

vi.mock('@/services/db/atmRequest.db', () => ({
  getUserAtmRequest: vi.fn(),
  getLatestUserAtmRequest: vi.fn(),
  searchUserAtmRequestsForAutocomplete: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: { event: vi.fn() }
}))

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string, description: string) => ({
    title,
    description
  }),
  createInfoEmbed: (title: string, description: string) => ({
    title,
    description
  })
}))

const mockCheckUserRegistration = vi.mocked(checkUserRegistration)
const mockGetGuildConfigByGuildId = vi.mocked(getGuildConfigByGuildId)
const mockGetUserAtmRequest = vi.mocked(getUserAtmRequest)
const mockGetLatestUserAtmRequest = vi.mocked(getLatestUserAtmRequest)
const mockSearchUserAtmRequestsForAutocomplete = vi.mocked(
  searchUserAtmRequestsForAutocomplete
)
const mockLoggerEvent = vi.mocked(logger.event)

const baseRequest = {
  requestId: 'req-1',
  guildId: 'guild-1',
  userId: 'user-1',
  type: 'withdraw' as const,
  amount: 1000,
  account: 'PayPal',
  status: 'pending' as const,
  createdAt: new Date('2026-06-15T12:30:00Z'),
  updatedAt: new Date('2026-06-15T12:30:00Z')
}

const createStatusInteraction = (requestId: string | null = null) => ({
  user: { id: 'user-1' },
  guildId: 'guild-1',
  options: {
    getString: (name: string) => (name === 'request' ? requestId : null)
  },
  reply: vi.fn().mockResolvedValue(undefined)
})

const createAutocompleteInteraction = ({
  focusedName = 'request',
  focusedValue = '',
  subcommand = 'status'
}: {
  focusedName?: string
  focusedValue?: string
  subcommand?: string
} = {}) => ({
  user: { id: 'user-1' },
  guildId: 'guild-1',
  options: {
    getFocused: (all?: boolean) =>
      all
        ? { name: focusedName, value: focusedValue }
        : focusedValue,
    getSubcommand: () => subcommand
  },
  respond: vi.fn().mockResolvedValue(undefined)
})

describe('handleAtmStatusSubcommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckUserRegistration.mockResolvedValue({
      userId: 'user-1',
      guildId: 'guild-1'
    } as never)
    mockGetGuildConfigByGuildId.mockResolvedValue({
      globalSettings: { currencySymbol: '$' }
    } as never)
  })

  it('returns early when user is not registered', async () => {
    mockCheckUserRegistration.mockResolvedValue(false)
    const interaction = createStatusInteraction()

    await handleAtmStatusSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).not.toHaveBeenCalled()
  })

  it('replies with status embed for a specific request', async () => {
    mockGetUserAtmRequest.mockResolvedValue(baseRequest as never)
    const interaction = createStatusInteraction('req-1')

    await handleAtmStatusSubcommand(interaction as never, 'withdraw')

    expect(mockGetUserAtmRequest).toHaveBeenCalledWith({
      requestId: 'req-1',
      guildId: 'guild-1',
      userId: 'user-1',
      type: 'withdraw'
    })
    expect(mockLoggerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'atm_withdraw_status_checked',
        requestId: 'req-1'
      }),
      'ATM withdrawal status checked'
    )
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: 64,
        embeds: [expect.objectContaining({ data: expect.any(Object) })]
      })
    )
  })

  it('replies with error when specific request is not found', async () => {
    mockGetUserAtmRequest.mockResolvedValue(null)
    const interaction = createStatusInteraction('missing')

    await handleAtmStatusSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            title: 'Request Not Found'
          })
        ]
      })
    )
  })

  it('replies with latest request when request option is omitted', async () => {
    mockGetLatestUserAtmRequest.mockResolvedValue(baseRequest as never)
    const interaction = createStatusInteraction(null)

    await handleAtmStatusSubcommand(interaction as never, 'withdraw')

    expect(mockGetLatestUserAtmRequest).toHaveBeenCalledWith({
      guildId: 'guild-1',
      userId: 'user-1',
      type: 'withdraw'
    })
    expect(interaction.reply).toHaveBeenCalledOnce()
  })

  it('replies with info when user has no requests', async () => {
    mockGetLatestUserAtmRequest.mockResolvedValue(null)
    const interaction = createStatusInteraction(null)

    await handleAtmStatusSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            title: 'No Withdrawals'
          })
        ]
      })
    )
  })

  it('replies with error when autocomplete none value is submitted', async () => {
    const interaction = createStatusInteraction('none')

    await handleAtmStatusSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            title: 'Request Not Found'
          })
        ]
      })
    )
  })

  it('uses deposit copy and event action', async () => {
    mockGetLatestUserAtmRequest.mockResolvedValue({
      ...baseRequest,
      type: 'deposit'
    } as never)
    const interaction = createStatusInteraction(null)

    await handleAtmStatusSubcommand(interaction as never, 'deposit')

    expect(mockLoggerEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'atm_deposit_status_checked' }),
      'ATM deposit status checked'
    )
    expect(interaction.reply).toHaveBeenCalledOnce()
  })
})

describe('respondAtmRequestStatusAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGuildConfigByGuildId.mockResolvedValue({
      globalSettings: { currencySymbol: '$' }
    } as never)
  })

  it('returns early when focused option is not request', async () => {
    const interaction = createAutocompleteInteraction({
      focusedName: 'amount'
    })

    await respondAtmRequestStatusAutocomplete(interaction as never, 'withdraw')

    expect(interaction.respond).not.toHaveBeenCalled()
  })

  it('responds with empty choice when no requests match', async () => {
    mockSearchUserAtmRequestsForAutocomplete.mockResolvedValue([])
    const interaction = createAutocompleteInteraction()

    await respondAtmRequestStatusAutocomplete(interaction as never, 'withdraw')

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'No withdrawal requests found', value: 'none' }
    ])
  })

  it('responds with mapped request choices', async () => {
    mockSearchUserAtmRequestsForAutocomplete.mockResolvedValue([
      {
        requestId: 'req-1',
        amount: 1000,
        status: 'pending',
        account: 'PayPal',
        createdAt: new Date('2026-06-15T12:30:00Z')
      }
    ] as never)
    const interaction = createAutocompleteInteraction({ focusedValue: 'pay' })

    await respondAtmRequestStatusAutocomplete(interaction as never, 'withdraw')

    expect(mockSearchUserAtmRequestsForAutocomplete).toHaveBeenCalledWith({
      guildId: 'guild-1',
      userId: 'user-1',
      type: 'withdraw',
      query: 'pay'
    })
    expect(interaction.respond).toHaveBeenCalledWith([
      expect.objectContaining({
        value: 'req-1'
      })
    ])
  })

  it('truncates long autocomplete labels to 100 characters', async () => {
    mockSearchUserAtmRequestsForAutocomplete.mockResolvedValue([
      {
        requestId: 'req-long',
        amount: 1_000_000,
        status: 'pending',
        account: 'A'.repeat(120),
        createdAt: new Date('2026-06-15T12:30:00Z')
      }
    ] as never)
    const interaction = createAutocompleteInteraction()

    await respondAtmRequestStatusAutocomplete(interaction as never, 'deposit')

    const choices = vi.mocked(interaction.respond).mock.calls[0]?.[0]
    expect(choices?.[0]?.name).toHaveLength(100)
    expect(choices?.[0]?.value).toBe('req-long')
  })

  it('uses deposit empty autocomplete copy', async () => {
    mockSearchUserAtmRequestsForAutocomplete.mockResolvedValue([])
    const interaction = createAutocompleteInteraction()

    await respondAtmRequestStatusAutocomplete(interaction as never, 'deposit')

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'No deposit requests found', value: 'none' }
    ])
  })
})
