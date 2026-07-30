import { describe, expect, it, vi } from 'vitest'

import {
  getQuestNotifyInteraction,
  runWithQuestNotifyInteraction
} from '@/services/quests/questNotifyContext'

describe('questNotifyContext', () => {
  it('exposes interaction only inside runWithQuestNotifyInteraction', async () => {
    expect(getQuestNotifyInteraction()).toBeNull()

    const interaction = {
      followUp: vi.fn(),
      deferred: true
    }

    await runWithQuestNotifyInteraction(interaction, async () => {
      expect(getQuestNotifyInteraction()).toBe(interaction)
    })

    expect(getQuestNotifyInteraction()).toBeNull()
  })
})
