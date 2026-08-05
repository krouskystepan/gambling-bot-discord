import { hoursUntilPlinkoIdleClose } from 'gambling-bot-shared/plinko'

import { Client } from 'commandkit'

import {
  getPlinkoGamesNeedingIdleNudge,
  markPlinkoIdleNudgeSent
} from '@/services/db/plinkoGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import {
  casinoGameMessageLink,
  sendCasinoIdleNudgeDm
} from '@/utils/casino/idleNudgeDm'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const plinkoIdleNudgeJob = async (client: Client<true>) => {
  const games = await getPlinkoGamesNeedingIdleNudge()
  if (!games.length) return

  let sent = 0
  const guildSent = new Map<string, number>()

  for (const game of games) {
    try {
      const hoursLeft = hoursUntilPlinkoIdleClose(game.updatedAt)
      const jumpLink = casinoGameMessageLink(game)

      const delivered = await sendCasinoIdleNudgeDm({
        client,
        userId: game.userId,
        title: 'Warning - Plinko Board Idle',
        body: [
          `Still dropping? If you stay inactive, this Plinko session will close in about **${hoursLeft} hour(s)**.`,
          '',
          `[Jump to your board](${jumpLink})`
        ].join('\n'),
        gameId: game.gameId
      })

      await markPlinkoIdleNudgeSent({
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
      logger.error(`Plinko idle nudge failed for game ${game.gameId}`, err)
    }
  }

  if (sent > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Plinko idle nudge',
      verb: 'sent',
      total: sent,
      unit: 'nudge(s)',
      guildCounts: guildSent
    })

    for (const [guildId, count] of guildSent) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Plinko reminders',
        title: `Reminded ${count} idle player(s)`,
        description:
          'Players with inactive Plinko boards were DMed before auto-close.',
        level: 'info'
      })
    }
  }
}
