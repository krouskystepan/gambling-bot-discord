import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deferComponentUpdate } from '@/utils/discord/deferComponentUpdate'

const baseInteraction = () => ({
  isMessageComponent: vi.fn(() => true),
  isModalSubmit: vi.fn(() => false),
  deferred: false,
  replied: false,
  deferUpdate: vi.fn().mockResolvedValue(undefined)
})

describe('deferComponentUpdate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false for non-component non-modal interactions', async () => {
    const interaction = {
      ...baseInteraction(),
      isMessageComponent: vi.fn(() => false),
      isModalSubmit: vi.fn(() => false)
    }

    await expect(deferComponentUpdate(interaction as never)).resolves.toBe(
      false
    )
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
  })

  it('returns true when already deferred or replied', async () => {
    const deferred = {
      ...baseInteraction(),
      deferred: true
    }
    const replied = {
      ...baseInteraction(),
      replied: true
    }

    await expect(deferComponentUpdate(deferred as never)).resolves.toBe(true)
    await expect(deferComponentUpdate(replied as never)).resolves.toBe(true)
    expect(deferred.deferUpdate).not.toHaveBeenCalled()
    expect(replied.deferUpdate).not.toHaveBeenCalled()
  })

  it('defers message components and modal submits', async () => {
    const component = baseInteraction()
    const modal = {
      ...baseInteraction(),
      isMessageComponent: vi.fn(() => false),
      isModalSubmit: vi.fn(() => true)
    }

    await expect(deferComponentUpdate(component as never)).resolves.toBe(true)
    await expect(deferComponentUpdate(modal as never)).resolves.toBe(true)
    expect(component.deferUpdate).toHaveBeenCalledOnce()
    expect(modal.deferUpdate).toHaveBeenCalledOnce()
  })

  it('returns false on unknown interaction (10062)', async () => {
    const interaction = {
      ...baseInteraction(),
      deferUpdate: vi.fn().mockRejectedValue({ code: 10062 })
    }

    await expect(deferComponentUpdate(interaction as never)).resolves.toBe(
      false
    )
  })

  it('returns true when already acknowledged (40060)', async () => {
    const interaction = {
      ...baseInteraction(),
      deferUpdate: vi.fn().mockRejectedValue({ code: 40060 })
    }

    await expect(deferComponentUpdate(interaction as never)).resolves.toBe(
      true
    )
  })

  it('rethrows unexpected defer errors', async () => {
    const interaction = {
      ...baseInteraction(),
      deferUpdate: vi.fn().mockRejectedValue({ code: 50013 })
    }

    await expect(deferComponentUpdate(interaction as never)).rejects.toEqual({
      code: 50013
    })
  })

  it('rethrows non-object defer errors', async () => {
    const interaction = {
      ...baseInteraction(),
      deferUpdate: vi.fn().mockRejectedValue('boom')
    }

    await expect(deferComponentUpdate(interaction as never)).rejects.toBe(
      'boom'
    )
  })
})
