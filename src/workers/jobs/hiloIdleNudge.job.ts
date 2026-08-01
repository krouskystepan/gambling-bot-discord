import { minutesUntilHiloTimeout } from 'gambling-bot-shared/casino'

import { Client } from 'commandkit'

import {
  getHiloGamesNeedingIdleNudge,
  markHiloIdleNudgeSent
} from '@/services/db/hiloGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import {
  casinoGameMessageLink,
  sendCasinoIdleNudgeDm
} from '@/utils/casino/idleNudgeDm'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const hiloIdleNudgeJob = async (client: Client<true>) => {
  const games = await getHiloGamesNeedingIdleNudge()
  if (!games.length) return

  let sent = 0
  const guildSent = new Map<string, number>()

  for (const game of games) {
    try {
      const minutesLeft = minutesUntilHiloTimeout(game.createdAt)
      const jumpLink = casinoGameMessageLink(game)

      const delivered = await sendCasinoIdleNudgeDm({
        client,
        userId: game.userId,
        title: 'Warning - Hi-Lo Round Idle',
        body: [
          `Still playing? You have about **${minutesLeft} minute(s)** left to guess.`,
          '',
          'If you stay inactive, a timeout fee will be taken and the rest of your bet will be refunded.',
          '',
          `[Jump to your Hi-Lo message](${jumpLink})`
        ].join('\n'),
        gameId: game.gameId
      })

      // Mark either way so we do not retry endlessly when DMs are closed.
      await markHiloIdleNudgeSent({
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
      logger.error(`Hi-Lo idle nudge failed for game ${game.gameId}`, err)
    }
  }

  if (sent > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Hi-Lo idle nudge',
      verb: 'sent',
      total: sent,
      unit: 'nudge(s)',
      guildCounts: guildSent
    })

    for (const [guildId, count] of guildSent) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Hi-Lo reminders',
        title: `Reminded ${count} idle player(s)`,
        description:
          'Players with inactive Hi-Lo rounds were DMed before the timeout fee.',
        level: 'info'
      })
    }
  }
}
