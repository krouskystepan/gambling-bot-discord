import type { HiloStoredCard, THiloGame } from 'gambling-bot-shared/casino'

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
  activeBetId: string
  betAmount: number
  firstCard: HiloStoredCard
  remainingDeck: HiloStoredCard[]
  houseEdgeSnapshot: number
  timeoutFeeSnapshot: number
  showBalance: boolean
  status?: THiloGame['status']
}
