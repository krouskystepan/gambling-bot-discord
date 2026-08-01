import { describe, expect, it, vi } from 'vitest'

import {
  casinoGameMessageLink,
  sendCasinoIdleNudgeDm
} from '@/utils/casino/idleNudgeDm'

describe('idleNudgeDm', () => {
  it('builds a discord jump link', () => {
    expect(
      casinoGameMessageLink({
        guildId: 'g',
        channelId: 'c',
        messageId: 'm'
      })
    ).toBe('https://discord.com/channels/g/c/m')
  })

  it('returns false when the user cannot be fetched', async () => {
    const client = {
      users: { fetch: vi.fn().mockRejectedValue(new Error('unknown user')) }
    }

    await expect(
      sendCasinoIdleNudgeDm({
        client: client as never,
        userId: 'missing',
        title: 'Idle',
        body: 'Hi',
        gameId: 'id-1'
      })
    ).resolves.toBe(false)
  })

  it('returns false when send fails', async () => {
    const client = {
      users: {
        fetch: vi.fn().mockResolvedValue({
          send: vi.fn().mockRejectedValue(new Error('dms closed'))
        })
      }
    }

    await expect(
      sendCasinoIdleNudgeDm({
        client: client as never,
        userId: 'user-1',
        title: 'Idle',
        body: 'Hi',
        gameId: 'id-1'
      })
    ).resolves.toBe(false)
  })

  it('returns true when the DM is delivered', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const client = {
      users: {
        fetch: vi.fn().mockResolvedValue({ send })
      }
    }

    await expect(
      sendCasinoIdleNudgeDm({
        client: client as never,
        userId: 'user-1',
        title: 'Idle',
        body: 'Hi',
        gameId: 'id-1'
      })
    ).resolves.toBe(true)

    expect(send).toHaveBeenCalledTimes(1)
  })
})
