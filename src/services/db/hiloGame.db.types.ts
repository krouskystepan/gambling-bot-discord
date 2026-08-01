import type {
  CasinoSessionStats,
  HiloStoredCard,
  THiloGame
} from 'gambling-bot-shared/casino'

export type TGetHiloGame = {
  userId: string
  guildId: string
}

export type TUpsertHiloGame = {
  userId: string
  guildId: string
  channelId: string
  messageId: string
  gameId: string
  activeBetId?: string | null
  betAmount: number | null
  firstCard?: HiloStoredCard | null
  remainingDeck?: HiloStoredCard[]
  houseEdgeSnapshot: number
  showBalance: boolean
  status?: THiloGame['status']
  sessionStats?: CasinoSessionStats
}

export type TUpdateHiloGame = {
  userId: string
  guildId: string
  channelId?: string
  messageId?: string
  activeBetId?: string | null
  betAmount?: number | null
  firstCard?: HiloStoredCard | null
  remainingDeck?: HiloStoredCard[]
  houseEdgeSnapshot?: number
  showBalance?: boolean
  status?: THiloGame['status']
  sessionStats?: CasinoSessionStats
}
