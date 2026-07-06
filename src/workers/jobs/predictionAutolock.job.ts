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

  for (const prediction of predictions) {
    try {
      const updated = await updatePredictionStatus({
        predictionId: prediction.predictionId,
        guildId: prediction.guildId,
        fromStatus: 'active',
        toStatus: 'ended'
      })
      if (!updated) continue

      const channel = await client.channels.fetch(prediction.channelId)
      if (!channel?.isTextBased()) continue

      const message = await channel.messages
        .fetch(prediction.predictionId)
        .catch(() => null)
      if (!message) continue

      const embed = message.embeds[0]?.toJSON()
      if (!embed) continue

      await message.edit({
        content: '**Status:** Ended',
        embeds: [{ ...embed, color: Colors.Orange }],
        components: []
      })

      locked++
      guildLocked.set(
        prediction.guildId,
        (guildLocked.get(prediction.guildId) ?? 0) + 1
      )
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
      await postWorkerLog(client, {
        guildId,
        worker: 'Prediction autolock',
        title: `Locked ${count} prediction(s)`,
        description: 'Active predictions past their autolock time were ended.'
      })
    }
  }
}
