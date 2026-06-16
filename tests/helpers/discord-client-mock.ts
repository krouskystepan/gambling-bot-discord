import { vi } from 'vitest'

export const createMockDiscordClient = ({
  actionChannelId = 'action-ch',
  logChannelId = 'log-ch',
  logMessageId = 'log-msg',
  fetchLogChannel = true,
  cacheActionChannel = true
}: {
  actionChannelId?: string
  logChannelId?: string
  logMessageId?: string
  fetchLogChannel?: boolean
  cacheActionChannel?: boolean
} = {}) => {
  const logMessageEdit = vi.fn().mockResolvedValue(undefined)
  const actionChannelSend = vi.fn().mockResolvedValue(undefined)
  const logMessageFetch = vi.fn().mockResolvedValue({ edit: logMessageEdit })

  const logChannel = { messages: { fetch: logMessageFetch } }
  const channelsFetch = fetchLogChannel
    ? vi.fn().mockResolvedValue(logChannel)
    : vi.fn().mockRejectedValue(new Error('channel fetch failed'))

  const actionChannel = { send: actionChannelSend }

  const client = {
    channels: {
      fetch: channelsFetch,
      cache: {
        get: vi.fn((id: string) => {
          if (!cacheActionChannel || id !== actionChannelId) return undefined
          return actionChannel
        })
      }
    }
  }

  return {
    client: client as never,
    logMessageEdit,
    actionChannelSend,
    logMessageFetch,
    channelsFetch,
    logChannelId,
    logMessageId,
    actionChannelId
  }
}
