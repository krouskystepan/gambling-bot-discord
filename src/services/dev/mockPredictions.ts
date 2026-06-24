import { generateId } from 'gambling-bot-shared/common'
import type { TPrediction } from 'gambling-bot-shared/predictions'

import Prediction from '@/models/Prediction'

import {
  type MockUserPools,
  PREDICTION_CHOICE_SETS,
  PREDICTION_TITLES,
  fakeChannelId,
  pickChipAmount,
  randomChoice,
  randomCreatedAt,
  randomInt,
  weightedRandomChoice
} from './constants'

export type MockPredictionsResult = {
  inserted: number
  statusCount: Record<string, number>
  totalBets: number
}

const PREDICTION_STATUS_WEIGHTS = {
  paid: 35,
  active: 22,
  ended: 15,
  paying: 8,
  canceled: 20
} as const

export async function mockPredictions({
  guildId,
  pools,
  count,
  days = 30,
  maxBet = 2000
}: {
  guildId: string
  pools: MockUserPools
  count: number
  days?: number
  maxBet?: number
}): Promise<MockPredictionsResult> {
  const docs: TPrediction[] = []
  const statusCount: Record<string, number> = {}
  let totalBets = 0

  for (let i = 0; i < count; i++) {
    const status = weightedRandomChoice(PREDICTION_STATUS_WEIGHTS)
    const createdAt = randomCreatedAt(days)
    const choiceNames = randomChoice(PREDICTION_CHOICE_SETS)
    const bettorCount = randomInt(2, Math.min(25, pools.userIds.length))

    const bettors = [...pools.userIds]
      .sort(() => Math.random() - 0.5)
      .slice(0, bettorCount)

    const choices = choiceNames.map((choiceName, index) => {
      const popularity = 1 / (index + 1 + Math.random())
      const bets = bettors
        .filter(() => Math.random() < popularity * 0.85)
        .map((userId) => {
          totalBets++
          return {
            userId,
            amount: pickChipAmount(maxBet),
            betId: generateId()
          }
        })

      return {
        choiceName,
        odds: randomChoice([1.5, 1.8, 2, 2.5, 3, 4, 5]),
        bets
      }
    })

    statusCount[status] = (statusCount[status] ?? 0) + 1

    docs.push({
      predictionId: generateId(),
      guildId,
      channelId: fakeChannelId(),
      creatorId: pools.pickAdmin(),
      title: randomChoice(PREDICTION_TITLES),
      choices,
      status,
      autolock:
        status === 'active'
          ? new Date(Date.now() + randomInt(1, 96) * 60 * 60 * 1000)
          : null,
      createdAt,
      updatedAt: createdAt
    })
  }

  await Prediction.insertMany(docs)

  return { inserted: docs.length, statusCount, totalBets }
}
