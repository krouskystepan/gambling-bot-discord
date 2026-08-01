import { beforeEach, describe, expect, it, vi } from 'vitest'

import { blackjackIdleNudgeJob } from '@/workers/jobs/blackjackIdleNudge.job'

vi.mock('@/services/db/blackjackGame.db', () => ({
  getBlackjackGamesNeedingIdleNudge: vi.fn(),
  markBlackjackIdleNudgeSent: vi.fn()
}))

vi.mock('@/services/worker/workerDiscordLog.service', () => ({
  postWorkerLog: vi.fn()
}))

vi.mock('@/utils/common/utils', () => ({
  sleep: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: { worker: vi.fn(), error: vi.fn() }
}))

const { getBlackjackGamesNeedingIdleNudge, markBlackjackIdleNudgeSent } =
  await import('@/services/db/blackjackGame.db')

const baseGame = {
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  messageId: 'message-1',
  gameId: 'game-nudge-1',
  phase: 'PLAYER',
  updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
}

describe('blackjackIdleNudgeJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('DMs the player with a jump link and game ID', async () => {
    vi.mocked(getBlackjackGamesNeedingIdleNudge).mockResolvedValue([
      baseGame
    ] as never)

    const send = vi.fn().mockResolvedValue(undefined)
    const client = {
      users: {
        fetch: vi.fn().mockResolvedValue({ send })
      }
    }

    await blackjackIdleNudgeJob(client as never)

    expect(client.users.fetch).toHaveBeenCalledWith('user-1')
    expect(send).toHaveBeenCalledTimes(1)
    const embed = send.mock.calls[0][0].embeds[0]
    expect(embed.data.description).toContain(
      '[Jump to your game message](https://discord.com/channels/guild-1/channel-1/message-1)'
    )
    expect(embed.data.footer?.text).toBe('ID: game-nudge-1')
    expect(markBlackjackIdleNudgeSent).toHaveBeenCalledWith({
      userId: 'user-1',
      guildId: 'guild-1'
    })
  })

  it('still marks nudge sent when DMs are closed', async () => {
    vi.mocked(getBlackjackGamesNeedingIdleNudge).mockResolvedValue([
      baseGame
    ] as never)

    const client = {
      users: {
        fetch: vi.fn().mockResolvedValue({
          send: vi.fn().mockRejectedValue(new Error('Cannot send messages'))
        })
      }
    }

    await blackjackIdleNudgeJob(client as never)

    expect(markBlackjackIdleNudgeSent).toHaveBeenCalledWith({
      userId: 'user-1',
      guildId: 'guild-1'
    })
  })
})
