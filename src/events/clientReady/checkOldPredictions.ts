import { Client } from 'discord.js'
import Prediction from '../../models/Prediction'

export default async (client: Client) => {
  console.log('👀 Prediction listener started')

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
  }, 24 * 60 * 60 * 1000) // every 24 hours
}
