import { describe, expect, it, vi } from 'vitest'

import { DiscordAPIError } from 'discord.js'

import type { Client } from 'commandkit'

import {
  checkGuildOrphaned,
  isUnknownGuildError
} from '@/workers/jobs/guildOrphanCleanup.job'

describe('guildOrphanCleanup detection', () => {
  it('detects Unknown Guild API errors', () => {
    const error = new DiscordAPIError(
      { message: 'Unknown Guild', code: 10004 },
      404,
      10004,
      'GET',
      'https://discord.com/api/v10/guilds/123',
      {}
    )

    expect(isUnknownGuildError(error)).toBe(true)
    expect(isUnknownGuildError(new Error('network'))).toBe(false)
  })

  it('treats cached guilds as members', async () => {
    const client = {
      guilds: {
        cache: { has: vi.fn().mockReturnValue(true) },
        fetch: vi.fn()
      }
    } as unknown as Client<true>

    await expect(checkGuildOrphaned(client, 'guild-1')).resolves.toBe('member')
    expect(client.guilds.fetch).not.toHaveBeenCalled()
  })

  it('treats successful fetch as member', async () => {
    const client = {
      guilds: {
        cache: { has: vi.fn().mockReturnValue(false) },
        fetch: vi.fn().mockResolvedValue({ id: 'guild-1' })
      }
    } as unknown as Client<true>

    await expect(checkGuildOrphaned(client, 'guild-1')).resolves.toBe('member')
  })

  it('treats Unknown Guild fetch errors as orphan', async () => {
    const client = {
      guilds: {
        cache: { has: vi.fn().mockReturnValue(false) },
        fetch: vi
          .fn()
          .mockRejectedValue(
            new DiscordAPIError(
              { message: 'Unknown Guild', code: 10004 },
              404,
              10004,
              'GET',
              'https://discord.com/api/v10/guilds/123',
              {}
            )
          )
      }
    } as unknown as Client<true>

    await expect(checkGuildOrphaned(client, 'guild-1')).resolves.toBe('orphan')
  })

  it('retries on other fetch errors', async () => {
    const client = {
      guilds: {
        cache: { has: vi.fn().mockReturnValue(false) },
        fetch: vi.fn().mockRejectedValue(new Error('rate limited'))
      }
    } as unknown as Client<true>

    await expect(checkGuildOrphaned(client, 'guild-1')).resolves.toBe('retry')
  })
})
