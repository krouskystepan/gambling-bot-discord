import { Client, Colors } from 'discord.js'

import { getPredictionToLock, updatePredictionStatus } from '@/services'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

export const autolockPredictions = async (client: Client) => {
  const predictions = await getPredictionToLock({
    status: 'active',
    useAutolock: true
    // limit: 25
  })

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

      logger.worker(
        `Prediction "${prediction.title}" (${prediction.predictionId}) auto-locked`
      )
      await sleep(300)
    } catch (err) {
      logger.error(
        `Failed to autolock prediction "${prediction.predictionId}"`,
        err
      )
    }
  }
}
