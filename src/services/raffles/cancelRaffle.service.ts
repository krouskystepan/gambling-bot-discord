import {
  type CancelRaffleResult,
  createRaffleLifecycleService
} from 'gambling-bot-shared/services'

import { refundRafflePurchase } from '@/services/casino'
import { raffleDb } from '@/services/db/raffle.db'

const raffleLifecycle = createRaffleLifecycleService({
  raffleDb,
  casinoBet: { refundRafflePurchase }
})

export type { CancelRaffleResult }

export const cancelRaffle = raffleLifecycle.cancelRaffle
