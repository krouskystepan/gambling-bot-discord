import { TUser } from 'gambling-bot-shared/user'

export type TGetMinesGame = Pick<TUser, 'userId' | 'guildId'>

export type TUpsertMinesGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId: string
  messageId: string
  betId: string
  betAmount: number
  mineCount: number
  mineIndices: number[]
  revealedIndices: number[]
  houseEdgeSnapshot: number
  status: 'ACTIVE' | 'FINISHED'
}
