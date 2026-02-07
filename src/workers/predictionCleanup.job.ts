import { deletePrediction, getOldPredictions } from '@/services'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

export const cleanupOldPredictions = async () => {
  const oldPredictions = await getOldPredictions({
    statuses: ['canceled', 'paid'],
    olderThanDays: 7
  })

  for (const prediction of oldPredictions) {
    try {
      await deletePrediction({ predictionId: prediction.predictionId })

      logger.worker(
        `Deleted old prediction "${prediction.title}" (${prediction.predictionId})`
      )
      await sleep(100)
    } catch (err) {
      logger.error(`Failed deleting prediction ${prediction.predictionId}`, err)
    }
  }
}
