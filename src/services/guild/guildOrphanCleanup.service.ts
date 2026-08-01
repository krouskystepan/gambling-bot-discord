import AtmRequest from '@/models/AtmRequest'
import Prediction from '@/models/Prediction'
import Raffle from '@/models/Raffle'
import VipRoom from '@/models/VipRoom'
import { rejectAtmRequest } from '@/services/atm/atmApproval.service'
import { refundLockedBet } from '@/services/casino'
import {
  deleteBaccaratGame,
  getBaccaratGamesByGuildId
} from '@/services/db/baccaratGame.db'
import {
  deleteBlackjackGame,
  getBlackjackGamesByGuildId
} from '@/services/db/blackjackGame.db'
import {
  deleteHiloGame,
  getHiloGamesByGuildId
} from '@/services/db/hiloGame.db'
import {
  deleteMinesGame,
  getMinesGamesByGuildId
} from '@/services/db/minesGame.db'
import { updatePredictionStatus } from '@/services/db/prediction.db'
import {
  deleteRouletteGame,
  getRouletteGamesByGuildId
} from '@/services/db/rouletteGame.db'
import {
  deleteSlotsGame,
  getSlotsGamesByGuildId
} from '@/services/db/slotsGame.db'
import { deleteVipByOwnerId } from '@/services/db/vip.db'
import { cancelPrediction } from '@/services/predictions/payPrediction.service'
import { cancelRaffle } from '@/services/raffles/cancelRaffle.service'
import { sleep } from '@/utils/common/utils'
import { logger } from '@/utils/logger'

export type GuildOrphanCleanupSummary = {
  predictions: number
  raffles: number
  blackjack: number
  baccarat: number
  mines: number
  roulette: number
  slots: number
  hilo: number
  vipRooms: number
  atmRejected: number
  errors: string[]
}

const CLEANUP_ITEM_DELAY_MS = 300

export const runGuildOrphanCleanup = async ({
  guildId
}: {
  guildId: string
}): Promise<GuildOrphanCleanupSummary> => {
  const summary: GuildOrphanCleanupSummary = {
    predictions: 0,
    raffles: 0,
    blackjack: 0,
    baccarat: 0,
    mines: 0,
    roulette: 0,
    slots: 0,
    hilo: 0,
    vipRooms: 0,
    atmRejected: 0,
    errors: []
  }

  const payingPredictions = await Prediction.find({
    guildId,
    status: 'paying'
  })

  for (const prediction of payingPredictions) {
    try {
      await updatePredictionStatus({
        predictionId: prediction.predictionId,
        guildId,
        fromStatus: 'paying',
        toStatus: 'ended'
      })

      const canceled = await cancelPrediction({
        predictionId: prediction.predictionId,
        guildId
      })

      if (canceled) {
        summary.predictions++
      }

      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `prediction ${prediction.predictionId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  const openPredictions = await Prediction.find({
    guildId,
    status: { $in: ['active', 'ended'] }
  })

  for (const prediction of openPredictions) {
    try {
      const canceled = await cancelPrediction({
        predictionId: prediction.predictionId,
        guildId
      })

      if (canceled) {
        summary.predictions++
      }

      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `prediction ${prediction.predictionId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  const activeRaffles = await Raffle.find({ guildId, status: 'active' })

  for (const raffle of activeRaffles) {
    try {
      const result = await cancelRaffle({
        raffleId: raffle.raffleId,
        guildId
      })

      if (result.ok) {
        summary.raffles++
      }

      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `raffle ${raffle.raffleId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  const blackjackGames = await getBlackjackGamesByGuildId({ guildId })

  for (const game of blackjackGames) {
    try {
      if (game.activeBetId) {
        const totalBet = game.hands.reduce(
          (sum, hand) => sum + hand.betAmount,
          0
        )

        await refundLockedBet({
          userId: game.userId,
          guildId: game.guildId,
          amount: totalBet,
          betId: game.activeBetId,
          game: 'blackjack'
        })
      }

      await deleteBlackjackGame({
        userId: game.userId,
        guildId: game.guildId
      })

      summary.blackjack++
      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `blackjack ${game.gameId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  const baccaratGames = await getBaccaratGamesByGuildId({ guildId })

  for (const game of baccaratGames) {
    try {
      if (game.activeBetId && game.betAmount != null) {
        await refundLockedBet({
          userId: game.userId,
          guildId: game.guildId,
          amount: game.betAmount,
          betId: game.activeBetId,
          game: 'baccarat'
        })
      }

      await deleteBaccaratGame({
        userId: game.userId,
        guildId: game.guildId
      })

      summary.baccarat++
      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `baccarat ${game.gameId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  const minesGames = await getMinesGamesByGuildId({ guildId })

  for (const game of minesGames) {
    try {
      if (game.activeBetId && game.betAmount != null) {
        await refundLockedBet({
          userId: game.userId,
          guildId: game.guildId,
          amount: game.betAmount,
          betId: game.activeBetId,
          game: 'mines'
        })
      }

      await deleteMinesGame({
        userId: game.userId,
        guildId: game.guildId
      })

      summary.mines++
      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `mines ${game.gameId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  const rouletteGames = await getRouletteGamesByGuildId({ guildId })

  for (const game of rouletteGames) {
    try {
      if (game.activeBetId && game.lockedAmount && game.lockedAmount > 0) {
        await refundLockedBet({
          userId: game.userId,
          guildId: game.guildId,
          amount: game.lockedAmount,
          betId: game.activeBetId,
          game: 'roulette'
        })
      }

      await deleteRouletteGame({
        userId: game.userId,
        guildId: game.guildId
      })

      summary.roulette++
      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `roulette ${game.gameId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  const slotsGames = await getSlotsGamesByGuildId({ guildId })

  for (const game of slotsGames) {
    try {
      if (game.activeBetId && game.lockedAmount && game.lockedAmount > 0) {
        await refundLockedBet({
          userId: game.userId,
          guildId: game.guildId,
          amount: game.lockedAmount,
          betId: game.activeBetId,
          game: 'slots'
        })
      }

      await deleteSlotsGame({
        userId: game.userId,
        guildId: game.guildId
      })

      summary.slots++
      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `slots ${game.gameId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  const hiloGames = await getHiloGamesByGuildId({ guildId })

  for (const game of hiloGames) {
    try {
      await refundLockedBet({
        userId: game.userId,
        guildId: game.guildId,
        amount: game.betAmount,
        betId: game.activeBetId,
        game: 'hilo'
      })

      await deleteHiloGame({
        userId: game.userId,
        guildId: game.guildId
      })

      summary.hilo++
      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `hilo ${game.gameId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  const vipRooms = await VipRoom.find({ guildId })

  for (const room of vipRooms) {
    try {
      await deleteVipByOwnerId({
        ownerId: room.ownerId,
        guildId
      })

      summary.vipRooms++
      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `vip ${room.ownerId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  const pendingAtmRequests = await AtmRequest.find({
    guildId,
    status: 'pending'
  })

  for (const request of pendingAtmRequests) {
    try {
      const result = await rejectAtmRequest({
        requestId: request.requestId,
        handledBy: 'system',
        notes: 'Bot left guild',
        source: 'web'
      })

      if (result.ok) {
        summary.atmRejected++
      }

      await sleep(CLEANUP_ITEM_DELAY_MS)
    } catch (error) {
      const message = `atm ${request.requestId}: ${String(error)}`
      summary.errors.push(message)
      logger.error(`Guild orphan cleanup failed for ${message}`, error)
    }
  }

  return summary
}
