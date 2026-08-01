import type { CasinoSessionStats } from 'gambling-bot-shared/casino'
import type { MinesGameStatus } from 'gambling-bot-shared/mines'
import { TUser } from 'gambling-bot-shared/user'

export type TGetMinesGame = Pick<TUser, 'userId' | 'guildId'>

export type TUpsertMinesGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId: string
  messageId: string
  gameId: string
  activeBetId?: string | null
  betAmount: number | null
  mineCount: number | null
  mineIndices: number[]
  revealedIndices: number[]
  houseEdgeSnapshot: number
  status: MinesGameStatus
  showBalance?: boolean
  sessionStats?: CasinoSessionStats
}

export type TUpdateMinesGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId?: string
  messageId?: string
  activeBetId?: string | null
  betAmount?: number | null
  mineCount?: number | null
  mineIndices?: number[]
  revealedIndices?: number[]
  houseEdgeSnapshot?: number
  status?: MinesGameStatus
  showBalance?: boolean
  sessionStats?: CasinoSessionStats
}
