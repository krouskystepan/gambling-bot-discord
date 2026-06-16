import { createRaffleDb } from 'gambling-bot-shared/services'

import Raffle from '@/models/Raffle'

export const raffleDb = createRaffleDb(Raffle)

export const {
  getRaffleById,
  upsertRaffle,
  addRaffleTickets,
  cancelRaffleAtomic,
  searchRafflesForAutocomplete,
  getRafflesReadyToDraw,
  completeRaffleDraw
} = raffleDb
