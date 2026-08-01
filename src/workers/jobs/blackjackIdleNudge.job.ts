import {
  hoursUntilBlackjackAutostand,
  hoursUntilBlackjackIdleClose
} from 'gambling-bot-shared/blackjack'

import { Client } from 'commandkit'

import {
  getBlackjackGamesNeedingIdleNudge,
  markBlackjackIdleNudgeSent
} from '@/services/db/blackjackGame.db'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import {
  casinoGameMessageLink,
  sendCasinoIdleNudgeDm
} from '@/utils/casino/idleNudgeDm'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'
import { logMultiGuildCountSummary } from '@/utils/worker/multiGuildWorkerLog'

export const blackjackIdleNudgeJob = async (client: Client<true>) => {
  const games = await getBlackjackGamesNeedingIdleNudge()
  if (!games.length) return

  let sent = 0
  const guildSent = new Map<string, number>()

  for (const game of games) {
    try {
      const isResult = game.phase === 'RESULT'
      const hoursLeft = isResult
        ? hoursUntilBlackjackIdleClose(game.updatedAt)
        : hoursUntilBlackjackAutostand(game.updatedAt)
      const jumpLink = casinoGameMessageLink(game)

      const delivered = await sendCasinoIdleNudgeDm({
        client,
        userId: game.userId,
        title: isResult
          ? 'Warning - Blackjack Table Idle'
          : 'Warning - Blackjack Game Idle',
        body: [
          isResult
            ? `Still playing? If you stay inactive, this table will close in about **${hoursLeft} hour(s)**.`
            : `Still playing? If you stay inactive, this game will auto-stand in about **${hoursLeft} hour(s)**.`,
          '',
          `[Jump to your game message](${jumpLink})`
        ].join('\n'),
        gameId: game.gameId
      })

      // Mark either way so we do not retry endlessly when DMs are closed.
      await markBlackjackIdleNudgeSent({
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
      logger.error(`Blackjack idle nudge failed for game ${game.gameId}`, err)
    }
  }

  if (sent > 0) {
    logMultiGuildCountSummary({
      client,
      job: 'Blackjack idle nudge',
      verb: 'sent',
      total: sent,
      unit: 'nudge(s)',
      guildCounts: guildSent
    })

    for (const [guildId, count] of guildSent) {
      await postWorkerLog(client, {
        guildId,
        worker: 'Blackjack reminders',
        title: `Reminded ${count} idle player(s)`,
        description:
          'Players with inactive blackjack games were DMed before auto-stand / close.',
        level: 'info'
      })
    }
  }
}
