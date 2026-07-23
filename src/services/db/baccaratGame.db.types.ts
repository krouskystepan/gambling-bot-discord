import { TUser } from 'gambling-bot-shared/user'

export type TGetBaccaratGame = Pick<TUser, 'userId' | 'guildId'>

export type TUpsertBaccaratGame = Pick<TUser, 'userId' | 'guildId'> & {
  channelId: string
  messageId: string
  betId: string
  betAmount: number
  showBalance: boolean
  skipAnimations: boolean
}
