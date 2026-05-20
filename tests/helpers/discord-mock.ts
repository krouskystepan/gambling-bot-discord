import { vi } from 'vitest'

import { MessageFlags } from 'discord.js'

export const createMockInteraction = () => {
  const reply = vi.fn().mockResolvedValue(undefined)

  return {
    reply,
    getLastReply: () => reply.mock.calls.at(-1)?.[0]
  }
}

export { MessageFlags }
