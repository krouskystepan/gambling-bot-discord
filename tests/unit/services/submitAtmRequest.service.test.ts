import { beforeEach, describe, expect, it, vi } from 'vitest'

import { submitAtmRequest } from '@/services/atm/submitAtmRequest.service'
import {
  attachAtmRequestMessage,
  createAtmRequest,
  deleteAtmRequest
} from '@/services/db/atmRequest.db'
import { logger } from '@/utils/logger'

vi.mock('gambling-bot-shared/common', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('gambling-bot-shared/common')>()
  return {
    ...actual,
    generateId: vi.fn(() => 'REQ123')
  }
})

vi.mock('@/services/db/atmRequest.db', () => ({
  createAtmRequest: vi.fn(),
  attachAtmRequestMessage: vi.fn(),
  deleteAtmRequest: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: { event: vi.fn() }
}))

const mockCreateAtmRequest = vi.mocked(createAtmRequest)
const mockAttachAtmRequestMessage = vi.mocked(attachAtmRequestMessage)
const mockDeleteAtmRequest = vi.mocked(deleteAtmRequest)
const mockLoggerEvent = vi.mocked(logger.event)

const baseGuildConfiguration = {
  guildId: 'guild-1',
  atmChannelIds: { logs: 'log-ch', actions: 'action-ch' },
  managerRoleId: 'role-1',
  globalSettings: { currencySymbol: '$', locale: 'en-US' }
}

const createInteraction = ({
  displayName = 'Nick',
  username = 'player',
  sendImpl
}: {
  displayName?: string | null
  username?: string
  sendImpl?: ReturnType<typeof vi.fn>
} = {}) => {
  const logMessageEdit = vi.fn().mockResolvedValue(undefined)
  const send =
    sendImpl ??
    vi.fn().mockResolvedValue({
      id: 'msg-1',
      edit: logMessageEdit
    })

  return {
    interaction: {
      user: { id: 'user-1', username, globalName: null },
      member: displayName ? { displayName } : null,
      guildId: 'guild-1',
      guild: {
        channels: {
          fetch: vi.fn().mockResolvedValue({
            id: 'log-ch',
            send,
            guild: { id: 'guild-1' }
          })
        }
      },
      reply: vi.fn().mockResolvedValue(undefined)
    } as never,
    send,
    logMessageEdit
  }
}

describe('submitAtmRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateAtmRequest.mockResolvedValue(undefined as never)
    mockAttachAtmRequestMessage.mockResolvedValue(undefined as never)
    mockDeleteAtmRequest.mockResolvedValue(undefined as never)
  })

  it('does not create a request when the log channel is inaccessible', async () => {
    const reply = vi.fn().mockResolvedValue(undefined)
    const interaction = {
      user: { id: 'user-1', username: 'player', globalName: null },
      member: null,
      guildId: 'guild-1',
      guild: {
        channels: {
          fetch: vi.fn().mockRejectedValue(new Error('missing channel'))
        }
      },
      reply
    } as never

    const result = await submitAtmRequest({
      interaction,
      type: 'deposit',
      amount: 100,
      account: 'PayPal',
      guildConfiguration: baseGuildConfiguration as never
    })

    expect(result).toEqual({ ok: false })
    expect(mockCreateAtmRequest).not.toHaveBeenCalled()
    expect(reply).toHaveBeenCalled()
  })

  it('creates the request, posts staff log with approve/reject buttons, and returns a player embed', async () => {
    const { interaction, send, logMessageEdit } = createInteraction()

    const result = await submitAtmRequest({
      interaction,
      type: 'deposit',
      amount: 100,
      account: 'PayPal',
      guildConfiguration: baseGuildConfiguration as never
    })

    expect(mockCreateAtmRequest).toHaveBeenCalledWith({
      requestId: 'REQ123',
      userId: 'user-1',
      guildId: 'guild-1',
      type: 'deposit',
      amount: 100,
      account: 'PayPal'
    })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '<@&role-1>',
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'ATM - Deposit by Nick (player)'
            })
          })
        ]
      })
    )
    expect(mockAttachAtmRequestMessage).toHaveBeenCalledWith(
      'REQ123',
      'log-ch',
      'msg-1'
    )
    expect(logMessageEdit).toHaveBeenCalledWith({
      components: [
        expect.objectContaining({
          components: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({ custom_id: 'atm.approve.REQ123' })
            }),
            expect.objectContaining({
              data: expect.objectContaining({ custom_id: 'atm.reject.REQ123' })
            })
          ])
        })
      ]
    })
    expect(mockLoggerEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'atm_deposit_requested' }),
      'ATM deposit request created'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.requestId).toBe('REQ123')
    expect(result.playerEmbed.data.title).toBe('ATM - Deposit')
  })

  it('posts a withdraw staff log without a manager ping when no role is configured', async () => {
    const { interaction, send } = createInteraction({ displayName: null })
    ;(interaction as { user: { globalName: string | null } }).user.globalName =
      'Global'

    const result = await submitAtmRequest({
      interaction,
      type: 'withdraw',
      amount: 50,
      account: 'Bank',
      guildConfiguration: {
        ...baseGuildConfiguration,
        managerRoleId: ''
      } as never
    })

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '',
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'ATM - Withdrawal by Global (player)'
            })
          })
        ]
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.playerEmbed.data.title).toBe('ATM - Withdraw')
  })

  it('deletes the request and rethrows when the staff log send fails', async () => {
    const { interaction } = createInteraction({
      displayName: null,
      sendImpl: vi.fn().mockRejectedValue(new Error('send failed'))
    })

    await expect(
      submitAtmRequest({
        interaction,
        type: 'deposit',
        amount: 100,
        account: 'PayPal',
        guildConfiguration: baseGuildConfiguration as never
      })
    ).rejects.toThrow('send failed')

    expect(mockDeleteAtmRequest).toHaveBeenCalledWith('REQ123')
    expect(mockAttachAtmRequestMessage).not.toHaveBeenCalled()
  })
})
