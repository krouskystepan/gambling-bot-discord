import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PermissionFlagsBits } from 'discord.js'

import { assertManagerOrAdmin } from '@/services/guild/assertManagerAccess.service'

import { createMockInteraction } from '../../helpers/discord-mock'

vi.mock('@/utils/discord/createEmbed', () => ({
  createErrorEmbed: (title: string) => ({ title })
}))

const MANAGER_ROLE_ID = 'role-manager-1'

const createInteraction = ({
  admin = false,
  hasManagerRole = false
}: {
  admin?: boolean
  hasManagerRole?: boolean
} = {}) => {
  const mock = createMockInteraction()

  return {
    user: { id: 'actor-1' },
    guild: {
      members: {
        fetch: vi.fn().mockResolvedValue({
          permissions: {
            has: (permission: bigint | string) =>
              admin &&
              (permission === PermissionFlagsBits.Administrator ||
                permission === 'Administrator')
          },
          roles: {
            cache: {
              has: (roleId: string) =>
                roleId === MANAGER_ROLE_ID && hasManagerRole
            }
          }
        })
      }
    },
    reply: mock.reply
  }
}

describe('assertManagerOrAdmin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('denies users without manager or admin access', async () => {
    const interaction = createInteraction()

    const result = await assertManagerOrAdmin(interaction as never, {
      managerRoleId: MANAGER_ROLE_ID
    })

    expect(result).toEqual({ ok: false })
    expect(interaction.reply).toHaveBeenCalledOnce()
  })

  it('uses fallback wording when manager role is not configured', async () => {
    const interaction = createInteraction()

    const result = await assertManagerOrAdmin(interaction as never, null)

    expect(result).toEqual({ ok: false })
    expect(interaction.reply).toHaveBeenCalledOnce()
  })

  it('allows managers and marks them as non-elevated', async () => {
    const interaction = createInteraction({ hasManagerRole: true })

    const result = await assertManagerOrAdmin(interaction as never, {
      managerRoleId: MANAGER_ROLE_ID
    })

    expect(result).toEqual({ ok: true, isElevated: false })
    expect(interaction.reply).not.toHaveBeenCalled()
  })

  it('allows administrators and marks them as elevated', async () => {
    const interaction = createInteraction({ admin: true })

    const result = await assertManagerOrAdmin(interaction as never, {
      managerRoleId: MANAGER_ROLE_ID
    })

    expect(result).toEqual({ ok: true, isElevated: true })
    expect(interaction.reply).not.toHaveBeenCalled()
  })
})
