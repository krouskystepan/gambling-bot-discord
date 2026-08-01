import { hoursUntilSlotsIdleClose } from 'gambling-bot-shared/slots'

import { Client } from 'commandkit'

import {
  getSlotsGamesNeedingIdleNudge,
  markSlotsIdleNudgeSent
} from '@/services/db/slotsGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import {
  casinoGameMessageLink,
  sendCasinoIdleNudgeDm
} from '@/utils/casino/idleNudgeDm'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const slotsIdleNudgeJob = async (client: Client<true>) => {
  const games = await getSlotsGamesNeedingIdleNudge()
  if (!games.length) return

  let sent = 0
  const guildSent = new Map<string, number>()

  for (const game of games) {
    try {
      const hoursLeft = hoursUntilSlotsIdleClose(game.updatedAt)
      const jumpLink = casinoGameMessageLink(game)

      const delivered = await sendCasinoIdleNudgeDm({
        client,
        userId: game.userId,
        title: 'Warning - Slots Machine Idle',
        body: [
          `Still spinning? If you stay inactive, this slots session will close in about **${hoursLeft} hour(s)**.`,
          '',
          `[Jump to your machine](${jumpLink})`
        ].join('\n'),
        gameId: game.gameId
      })

      await markSlotsIdleNudgeSent({
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
      logger.error(`Slots idle nudge failed for game ${game.gameId}`, err)
    }
  }

  if (sent > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Slots idle nudge',
      verb: 'sent',
      total: sent,
      unit: 'nudge(s)',
      guildCounts: guildSent
    })

    for (const [guildId, count] of guildSent) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Slots reminders',
        title: `Reminded ${count} idle player(s)`,
        description:
          'Players with inactive slots machines were DMed before auto-close.',
        level: 'info'
      })
    }
  }
}
