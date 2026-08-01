import { hoursUntilMinesAutoResolve } from 'gambling-bot-shared/mines'

import { Client } from 'commandkit'

import {
  getMinesGamesNeedingIdleNudge,
  markMinesIdleNudgeSent
} from '@/services/db/minesGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import {
  casinoGameMessageLink,
  sendCasinoIdleNudgeDm
} from '@/utils/casino/idleNudgeDm'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const minesIdleNudgeJob = async (client: Client<true>) => {
  const games = await getMinesGamesNeedingIdleNudge()
  if (!games.length) return

  let sent = 0
  const guildSent = new Map<string, number>()

  for (const game of games) {
    try {
      const hoursLeft = hoursUntilMinesAutoResolve(game.updatedAt)
      const jumpLink = casinoGameMessageLink(game)

      const delivered = await sendCasinoIdleNudgeDm({
        client,
        userId: game.userId,
        title: 'Warning - Mines Game Idle',
        body: [
          `Still playing? If you stay inactive, this game will auto-resolve in about **${hoursLeft} hour(s)**.`,
          '',
          `[Jump to your game message](${jumpLink})`
        ].join('\n'),
        gameId: game.gameId
      })

      await markMinesIdleNudgeSent({
        userId: game.userId,
        guildId: game.guildId
      })

      if (!delivered) {
        await sleep(500)
        continue
      }

      sent++
      guildSent.set(game.guildId, (guildSent.get(game.guildId) ?? 0) + 1)
      await sleep(500)
    } catch (err) {
      logger.error(`Mines idle nudge failed for game ${game.gameId}`, err)
    }
  }

  if (sent > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Mines idle nudge',
      verb: 'sent',
      total: sent,
      unit: 'nudge(s)',
      guildCounts: guildSent
    })

    for (const [guildId, count] of guildSent) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Mines reminders',
        title: `Reminded ${count} idle player(s)`,
        description:
          'Players with inactive mines games were DMed before auto-resolve.',
        level: 'info'
      })
    }
  }
}
