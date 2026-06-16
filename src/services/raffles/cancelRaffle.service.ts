import { type CancelRaffleResult } from 'gambling-bot-shared/raffle'
import { createRaffleLifecycleService } from 'gambling-bot-shared/raffle'

import { refundRafflePurchase } from '@/services/casino'
import { raffleDb } from '@/services/db/raffle.db'

const raffleLifecycle = createRaffleLifecycleService({
  raffleDb,
  casinoBet: { refundRafflePurchase }
})

export type { CancelRaffleResult }

export const cancelRaffle = raffleLifecycle.cancelRaffle
