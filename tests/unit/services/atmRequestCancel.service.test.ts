import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getLatestUserPendingAtmRequest,
  getUserAtmRequest,
  searchUserPendingAtmRequestsForAutocomplete
} from '@/services/db/atmRequest.db'
import {
  handleAtmCancelSubcommand,
  respondAtmRequestCancelAutocomplete
} from '@/services/atm/atmRequestCancel.service'
import { cancelUserAtmRequest } from '@/services/atm/cancelAtmRequest.service'
import { checkUserRegistration, getGuildConfigByGuildId } from '@/services'

vi.mock('@/services', () => ({
  checkUserRegistration: vi.fn(),
  getGuildConfigByGuildId: vi.fn()
}))

vi.mock('@/services/db/atmRequest.db', () => ({
  getUserAtmRequest: vi.fn(),
  getLatestUserPendingAtmRequest: vi.fn(),
  searchUserPendingAtmRequestsForAutocomplete: vi.fn()
}))

vi.mock('@/services/atm/cancelAtmRequest.service', () => ({
  cancelUserAtmRequest: vi.fn()
}))

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string, description: string) => ({
    title,
    description
  }),
  createInfoEmbed: (title: string, description: string) => ({
    title,
    description
  }),
  createSuccessEmbed: (title: string, description: string) => ({
    title,
    description
  })
}))

const mockCheckUserRegistration = vi.mocked(checkUserRegistration)
const mockGetGuildConfigByGuildId = vi.mocked(getGuildConfigByGuildId)
const mockGetUserAtmRequest = vi.mocked(getUserAtmRequest)
const mockGetLatestUserPendingAtmRequest = vi.mocked(
  getLatestUserPendingAtmRequest
)
const mockCancelUserAtmRequest = vi.mocked(cancelUserAtmRequest)

const mockSearchUserPendingAtmRequestsForAutocomplete = vi.mocked(
  searchUserPendingAtmRequestsForAutocomplete
)

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

const createCancelInteraction = (requestId: string | null = null) => ({
  user: { id: 'user-1' },
  guildId: 'guild-1',
  client: { channels: { fetch: vi.fn() } },
  options: {
    getString: (name: string) => (name === 'request' ? requestId : null)
  },
  reply: vi.fn().mockResolvedValue(undefined)
})

const createAutocompleteInteraction = ({
  focusedName = 'request',
  focusedValue = ''
}: {
  focusedName?: string
  focusedValue?: string
} = {}) => ({
  user: { id: 'user-1' },
  guildId: 'guild-1',
  options: {
    getFocused: (all?: boolean) =>
      all ? { name: focusedName, value: focusedValue } : focusedValue
  },
  respond: vi.fn().mockResolvedValue(undefined)
})

describe('handleAtmCancelSubcommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckUserRegistration.mockResolvedValue({
      userId: 'user-1',
      guildId: 'guild-1'
    } as never)
    mockGetGuildConfigByGuildId.mockResolvedValue({
      globalSettings: { currencySymbol: '$' }
    } as never)
    mockCancelUserAtmRequest.mockResolvedValue({
      ok: true,
      request: { ...baseRequest, status: 'cancelled' }
    } as never)
  })

  it('returns early when user is not registered', async () => {
    mockCheckUserRegistration.mockResolvedValue(false)
    const interaction = createCancelInteraction()

    await handleAtmCancelSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).not.toHaveBeenCalled()
  })

  it('cancels a specific pending request', async () => {
    mockGetUserAtmRequest.mockResolvedValue(baseRequest as never)
    const interaction = createCancelInteraction('req-1')

    await handleAtmCancelSubcommand(interaction as never, 'withdraw')

    expect(mockCancelUserAtmRequest).toHaveBeenCalledWith({
      requestId: 'req-1',
      guildId: 'guild-1',
      userId: 'user-1',
      type: 'withdraw',
      client: interaction.client
    })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            title: 'ATM - Withdrawal Cancelled'
          })
        ]
      })
    )
  })

  it('replies with error when specific request is not found', async () => {
    mockGetUserAtmRequest.mockResolvedValue(null)
    const interaction = createCancelInteraction('missing')

    await handleAtmCancelSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: 'Request Not Found' })]
      })
    )
  })

  it('replies with error when specific request is not pending', async () => {
    mockGetUserAtmRequest.mockResolvedValue({
      ...baseRequest,
      status: 'approved'
    } as never)
    const interaction = createCancelInteraction('req-1')

    await handleAtmCancelSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: 'Request Not Pending' })]
      })
    )
    expect(mockCancelUserAtmRequest).not.toHaveBeenCalled()
  })

  it('cancels latest pending request when option is omitted', async () => {
    mockGetLatestUserPendingAtmRequest.mockResolvedValue(baseRequest as never)
    const interaction = createCancelInteraction(null)

    await handleAtmCancelSubcommand(interaction as never, 'withdraw')

    expect(mockGetLatestUserPendingAtmRequest).toHaveBeenCalledWith({
      guildId: 'guild-1',
      userId: 'user-1',
      type: 'withdraw'
    })
    expect(mockCancelUserAtmRequest).toHaveBeenCalledOnce()
  })

  it('replies with info when user has no pending requests', async () => {
    mockGetLatestUserPendingAtmRequest.mockResolvedValue(null)
    const interaction = createCancelInteraction(null)

    await handleAtmCancelSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({ title: 'No Pending Withdrawals' })
        ]
      })
    )
  })

  it('replies with info when autocomplete none value is submitted', async () => {
    const interaction = createCancelInteraction('none')

    await handleAtmCancelSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({ title: 'No Pending Withdrawals' })
        ]
      })
    )
  })

  it('replies with race condition error', async () => {
    mockGetLatestUserPendingAtmRequest.mockResolvedValue(baseRequest as never)
    mockCancelUserAtmRequest.mockResolvedValue({
      ok: false,
      code: 'RACE_CONDITION'
    })
    const interaction = createCancelInteraction(null)

    await handleAtmCancelSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: 'Already Handled' })]
      })
    )
  })

  it('replies with not pending when cancel service returns NOT_FOUND', async () => {
    mockGetLatestUserPendingAtmRequest.mockResolvedValue(baseRequest as never)
    mockCancelUserAtmRequest.mockResolvedValue({
      ok: false,
      code: 'NOT_FOUND'
    })
    const interaction = createCancelInteraction(null)

    await handleAtmCancelSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: 'Request Not Pending' })]
      })
    )
  })

  it('replies with not pending when cancel service returns NOT_PENDING', async () => {
    mockGetLatestUserPendingAtmRequest.mockResolvedValue(baseRequest as never)
    mockCancelUserAtmRequest.mockResolvedValue({
      ok: false,
      code: 'NOT_PENDING'
    })
    const interaction = createCancelInteraction(null)

    await handleAtmCancelSubcommand(interaction as never, 'withdraw')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: 'Request Not Pending' })]
      })
    )
  })

  it('uses deposit copy on success', async () => {
    mockGetLatestUserPendingAtmRequest.mockResolvedValue({
      ...baseRequest,
      type: 'deposit'
    } as never)
    const interaction = createCancelInteraction(null)

    await handleAtmCancelSubcommand(interaction as never, 'deposit')

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({ title: 'ATM - Deposit Cancelled' })
        ]
      })
    )
  })
})

describe('respondAtmRequestCancelAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGuildConfigByGuildId.mockResolvedValue({
      globalSettings: { currencySymbol: '$' }
    } as never)
  })

  it('returns early when focused option is not request', async () => {
    const interaction = createAutocompleteInteraction({ focusedName: 'amount' })

    await respondAtmRequestCancelAutocomplete(interaction as never, 'withdraw')

    expect(interaction.respond).not.toHaveBeenCalled()
  })

  it('responds with empty choice when no pending requests match', async () => {
    mockSearchUserPendingAtmRequestsForAutocomplete.mockResolvedValue([])
    const interaction = createAutocompleteInteraction()

    await respondAtmRequestCancelAutocomplete(interaction as never, 'withdraw')

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'No pending withdrawal requests found', value: 'none' }
    ])
  })

  it('responds with mapped pending request choices', async () => {
    mockSearchUserPendingAtmRequestsForAutocomplete.mockResolvedValue([
      {
        requestId: 'req-1',
        amount: 1000,
        status: 'pending',
        account: 'PayPal',
        createdAt: new Date('2026-06-15T12:30:00Z')
      }
    ] as never)
    const interaction = createAutocompleteInteraction({ focusedValue: 'pay' })

    await respondAtmRequestCancelAutocomplete(interaction as never, 'withdraw')

    expect(mockSearchUserPendingAtmRequestsForAutocomplete).toHaveBeenCalledWith(
      {
        guildId: 'guild-1',
        userId: 'user-1',
        type: 'withdraw',
        query: 'pay'
      }
    )
    expect(interaction.respond).toHaveBeenCalledWith([
      expect.objectContaining({ value: 'req-1' })
    ])
  })

  it('uses deposit empty autocomplete copy', async () => {
    mockSearchUserPendingAtmRequestsForAutocomplete.mockResolvedValue([])
    const interaction = createAutocompleteInteraction()

    await respondAtmRequestCancelAutocomplete(interaction as never, 'deposit')

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'No pending deposit requests found', value: 'none' }
    ])
  })
})
