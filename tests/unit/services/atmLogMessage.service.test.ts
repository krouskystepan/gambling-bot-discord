import { describe, expect, it, vi } from 'vitest'

import { editAtmLogMessage } from '@/services/atm/atmLogMessage.service'
import { logger } from '@/utils/logger'

import { createMockDiscordClient } from '../../helpers/discord-client-mock'

describe('editAtmLogMessage', () => {
  it('edits log message and removes components', async () => {
    const { client, logMessageEdit } = createMockDiscordClient()

    await editAtmLogMessage({
      client: client as never,
      request: {
        requestId: 'req-1',
        guildId: 'guild-1',
        userId: 'user-1',
        type: 'deposit',
        amount: 100,
        account: 'acc-1',
        status: 'pending',
        logChannelId: 'log-ch',
        logMessageId: 'log-msg',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      content: '❌ Cancelled by <@user-1>'
    })

    expect(logMessageEdit).toHaveBeenCalledWith({
      content: '❌ Cancelled by <@user-1>',
      components: []
    })
  })

  it('no-ops when log message ids are missing', async () => {
    const { client, channelsFetch } = createMockDiscordClient()

    await editAtmLogMessage({
      client: client as never,
      request: {
        requestId: 'req-2',
        guildId: 'guild-1',
        userId: 'user-1',
        type: 'deposit',
        amount: 100,
        account: 'acc-1',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      content: 'ignored'
    })

    expect(channelsFetch).not.toHaveBeenCalled()
  })

  it('logs error when channel fetch fails', async () => {
    const { client } = createMockDiscordClient({ fetchLogChannel: false })
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    await editAtmLogMessage({
      client: client as never,
      request: {
        requestId: 'req-3',
        guildId: 'guild-1',
        userId: 'user-1',
        type: 'deposit',
        amount: 100,
        account: 'acc-1',
        status: 'pending',
        logChannelId: 'log-ch',
        logMessageId: 'log-msg',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      content: '❌ Cancelled by <@user-1>'
    })

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-3',
        handler: 'atmLogMessage'
      }),
      'Failed to update ATM log message'
    )
    errorSpy.mockRestore()
  })
})
