import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChannelType } from 'discord.js'

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
  betId: 'bet-nudge-1',
  updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
}

describe('blackjackIdleNudgeJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('includes a jump link and bet ID in the nudge embed', async () => {
    vi.mocked(getBlackjackGamesNeedingIdleNudge).mockResolvedValue([
      baseGame
    ] as never)

    const send = vi.fn().mockResolvedValue(undefined)
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          channels: {
            fetch: vi.fn().mockResolvedValue({
              type: ChannelType.GuildText,
              send
            })
          }
        })
      }
    }

    await blackjackIdleNudgeJob(client as never)

    expect(send).toHaveBeenCalledTimes(1)
    const embed = send.mock.calls[0][0].embeds[0]
    expect(embed.data.description).toContain(
      '[Jump to your game message](https://discord.com/channels/guild-1/channel-1/message-1)'
    )
    expect(embed.data.footer?.text).toBe('ID: bet-nudge-1')
    expect(markBlackjackIdleNudgeSent).toHaveBeenCalledWith({
      userId: 'user-1',
      guildId: 'guild-1'
    })
  })
})
