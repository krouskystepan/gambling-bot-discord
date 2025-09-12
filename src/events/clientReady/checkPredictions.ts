import { Client, Colors } from 'discord.js'
import Prediction from '../../models/Prediction'

export default async (client: Client) => {
  console.log('👀 Prediction listener started')

  // OLD PREDICTION CLEANUP
  setInterval(async () => {
    const now = new Date()
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days

    const oldPredictions = await Prediction.find({
      status: { $in: ['canceled', 'paid'] },
      updatedAt: { $lte: oneMonthAgo },
    })

    for (const prediction of oldPredictions) {
      await Prediction.deleteOne({ _id: prediction._id })
      console.log(
        `Deleted old prediction "${prediction.title}" (${prediction.predictionId}) with status "${prediction.status}".`
      )
    }
  }, 24 * 60 * 60 * 1000) // 24 hours

  // AUTOLOCK CHECK
  setInterval(async () => {
    const now = new Date()

    const predictionsToLock = await Prediction.find({
      status: 'active',
      autolock: { $lte: now },
    })

    if (predictionsToLock.length === 0) return

    for (const prediction of predictionsToLock) {
      try {
        prediction.status = 'ended'
        await prediction.save()

        const channel = await client.channels.fetch(prediction.channelId)
        if (!channel?.isTextBased()) continue

        const message = await channel.messages
          .fetch(prediction.predictionId)
          .catch(() => null)
        if (!message) continue

        const embed = message.embeds[0]?.toJSON() || {}
        const editedEmbed = { ...embed, color: Colors.Orange }

        await message.edit({
          content: '**Status:** Ended',
          embeds: [editedEmbed],
          components: [],
        })

        console.log(
          `Prediction "${prediction.title}" (${prediction.predictionId}) was auto-locked.`
        )
      } catch (err) {
        console.error(
          `Failed to autolock prediction "${prediction.title}" (${prediction.predictionId}):`,
          err
        )
      }
    }
  }, 60 * 1000) // 1 Minute
}
