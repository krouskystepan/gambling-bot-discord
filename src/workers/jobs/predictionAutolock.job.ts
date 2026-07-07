import { Colors } from 'discord.js'

import { Client } from 'commandkit'

import { getPredictionToLock, updatePredictionStatus } from '@/services'
import { postWorkerLog } from '@/services/worker/workerDiscordLog.service'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

export const predictionAutolockJob = async (client: Client<true>) => {
  const predictions = await getPredictionToLock({
    status: 'active',
    useAutolock: true
    // limit: 25
  })

  let locked = 0
  const guildLocked = new Map<string, number>()
  const guildDiscordMissed = new Map<string, number>()

  for (const prediction of predictions) {
    try {
      const updated = await updatePredictionStatus({
        predictionId: prediction.predictionId,
        guildId: prediction.guildId,
        fromStatus: 'active',
        toStatus: 'ended'
      })
      if (!updated) continue

      locked++
      guildLocked.set(
        prediction.guildId,
        (guildLocked.get(prediction.guildId) ?? 0) + 1
      )

      const channel = await client.channels
        .fetch(prediction.channelId)
        .catch(() => null)
      if (!channel?.isTextBased()) {
        guildDiscordMissed.set(
          prediction.guildId,
          (guildDiscordMissed.get(prediction.guildId) ?? 0) + 1
        )
        continue
      }

      const message = await channel.messages
        .fetch(prediction.predictionId)
        .catch(() => null)
      if (!message) {
        guildDiscordMissed.set(
          prediction.guildId,
          (guildDiscordMissed.get(prediction.guildId) ?? 0) + 1
        )
        continue
      }

      const embed = message.embeds[0]?.toJSON()
      if (!embed) {
        guildDiscordMissed.set(
          prediction.guildId,
          (guildDiscordMissed.get(prediction.guildId) ?? 0) + 1
        )
        continue
      }

      await message.edit({
        content: '**Status:** Ended',
        embeds: [{ ...embed, color: Colors.Orange }],
        components: []
      })

      await sleep(300)
    } catch (err) {
      logger.error(
        `Failed to autolock prediction "${prediction.predictionId}"`,
        err
      )
    }
  }

  if (locked > 0) {
    logger.worker(`Prediction autolock: locked ${locked}`)

    for (const [guildId, count] of guildLocked) {
      const missed = guildDiscordMissed.get(guildId) ?? 0
      const description = [
        'Predictions past their deadline were closed for new bets.',
        missed > 0 ? `**${missed}** could not be updated in Discord.` : null
      ]
        .filter(Boolean)
        .join('\n\n')

      await postWorkerLog(client, {
        guildId,
        worker: 'Predictions',
        title: `Closed ${count} prediction(s)`,
        description,
        level: missed > 0 ? 'warning' : 'info'
      })
    }
  }
}
