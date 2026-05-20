import { describe, expect, it } from 'vitest'

import { isGuildSendableChannel } from '@/utils/discord/channelGuards'

describe('isGuildSendableChannel', () => {
  it('returns true for objects with send and guild', () => {
    expect(
      isGuildSendableChannel({
        send: async () => undefined,
        guild: { id: 'guild-1' }
      })
    ).toBe(true)
  })

  it('returns false for null, primitives, and partial objects', () => {
    expect(isGuildSendableChannel(null)).toBe(false)
    expect(isGuildSendableChannel(undefined)).toBe(false)
    expect(isGuildSendableChannel({ guild: { id: 'g' } })).toBe(false)
    expect(isGuildSendableChannel({ send: () => undefined })).toBe(false)
  })
})
