import { hoursUntilRouletteIdleClose } from 'gambling-bot-shared/roulette'

import { Client } from 'commandkit'

import {
  getRouletteGamesNeedingIdleNudge,
  markRouletteIdleNudgeSent
} from '@/services/db/rouletteGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import {
  casinoGameMessageLink,
  sendCasinoIdleNudgeDm
} from '@/utils/casino/idleNudgeDm'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const rouletteIdleNudgeJob = async (client: Client<true>) => {
  const games = await getRouletteGamesNeedingIdleNudge()
  if (!games.length) return

  let sent = 0
  const guildSent = new Map<string, number>()

  for (const game of games) {
    try {
      const hoursLeft = hoursUntilRouletteIdleClose(game.updatedAt)
      const jumpLink = casinoGameMessageLink(game)

      const delivered = await sendCasinoIdleNudgeDm({
        client,
        userId: game.userId,
        title: 'Warning - Roulette Table Idle',
        body: [
          `Still at the table? If you stay inactive, this roulette session will close in about **${hoursLeft} hour(s)**.`,
          '',
          `[Jump to your table](${jumpLink})`
        ].join('\n'),
        gameId: game.gameId
      })

      await markRouletteIdleNudgeSent({
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
      logger.error(`Roulette idle nudge failed for game ${game.gameId}`, err)
    }
  }

  if (sent > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Roulette idle nudge',
      verb: 'sent',
      total: sent,
      unit: 'nudge(s)',
      guildCounts: guildSent
    })

    for (const [guildId, count] of guildSent) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Roulette reminders',
        title: `Reminded ${count} idle player(s)`,
        description:
          'Players with inactive roulette tables were DMed before auto-close.',
        level: 'info'
      })
    }
  }
}
