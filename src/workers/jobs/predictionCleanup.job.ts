import { deletePrediction, getOldPredictions } from '@/services'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

export const predictionCleanupJob = async () => {
  const oldPredictions = await getOldPredictions({
    statuses: ['canceled', 'paid'],
    olderThanDays: 7
  })

  let deleted = 0

  for (const prediction of oldPredictions) {
    try {
      await deletePrediction({ predictionId: prediction.predictionId })
      deleted++
      await sleep(100)
    } catch (err) {
      logger.error(`Failed deleting prediction ${prediction.predictionId}`, err)
    }
  }

  if (deleted > 0) {
    logger.worker(`Prediction cleanup: deleted ${deleted}`)
  }
}
