import { TPrediction } from 'gambling-bot-shared'

import { refundLockedBet, settleCasinoWinnings } from '@/services/casino'
import { getPredictionById, updatePredictionStatus } from '@/services/db'

type PredictionBet = TPrediction['choices'][number]['bets'][number]

export type PayPredictionResult =
  | {
      ok: true
      outcome: 'paid' | 'refunded'
      prediction: TPrediction
      winnerChoice?: string
    }
  | {
      ok: false
      code:
        | 'NOT_FOUND'
        | 'INVALID_STATUS'
        | 'ALREADY_HANDLED'
        | 'INVALID_WINNER'
    }

const resolveBetId = (bet: PredictionBet, predictionId: string) =>
  bet.betId ?? `${predictionId}:${bet.userId}`

const finalizePaid = async (predictionId: string, guildId: string) => {
  const paid = await updatePredictionStatus({
    predictionId,
    guildId,
    fromStatus: 'paying',
    toStatus: 'paid'
  })

  if (!paid) throw new Error('FINALIZE_FAILED')

  return paid
}

const rollbackPaying = async (predictionId: string, guildId: string) => {
  await updatePredictionStatus({
    predictionId,
    guildId,
    fromStatus: 'paying',
    toStatus: 'ended'
  })
}

export const payPrediction = async ({
  predictionId,
  guildId,
  winnerChoice
}: {
  predictionId: string
  guildId: string
  winnerChoice: string
}): Promise<PayPredictionResult> => {
  const prediction = await getPredictionById({ predictionId, guildId })
  if (!prediction) return { ok: false, code: 'NOT_FOUND' }

  if (prediction.status !== 'ended') {
    if (prediction.status === 'paid' || prediction.status === 'paying') {
      return { ok: false, code: 'ALREADY_HANDLED' }
    }

    return { ok: false, code: 'INVALID_STATUS' }
  }

  const winner = prediction.choices.find((c) => c.choiceName === winnerChoice)
  if (!winner) return { ok: false, code: 'INVALID_WINNER' }

  const locked = await updatePredictionStatus({
    predictionId,
    guildId,
    fromStatus: 'ended',
    toStatus: 'paying'
  })

  if (!locked) return { ok: false, code: 'ALREADY_HANDLED' }

  try {
    const allBets = prediction.choices.flatMap((c) => c.bets)

    if (winner.bets.length === 0) {
      for (const bet of allBets) {
        await refundLockedBet({
          userId: bet.userId,
          guildId,
          amount: bet.amount,
          betId: resolveBetId(bet, predictionId),
          game: 'prediction'
        })
      }

      const paid = await finalizePaid(predictionId, guildId)
      return { ok: true, outcome: 'refunded', prediction: paid }
    }

    for (const bet of winner.bets) {
      await settleCasinoWinnings({
        userId: bet.userId,
        guildId,
        totalBet: bet.amount,
        winnings: bet.amount * winner.odds,
        betId: resolveBetId(bet, predictionId),
        game: 'prediction'
      })
    }

    const losingChoices = prediction.choices.filter(
      (c) => c.choiceName !== winnerChoice
    )

    for (const choice of losingChoices) {
      for (const bet of choice.bets) {
        await settleCasinoWinnings({
          userId: bet.userId,
          guildId,
          totalBet: bet.amount,
          winnings: 0,
          betId: resolveBetId(bet, predictionId),
          game: 'prediction'
        })
      }
    }

    const paid = await finalizePaid(predictionId, guildId)
    return {
      ok: true,
      outcome: 'paid',
      prediction: paid,
      winnerChoice
    }
  } catch (error) {
    await rollbackPaying(predictionId, guildId)
    throw error
  }
}
